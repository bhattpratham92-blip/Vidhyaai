import { NextRequest } from 'next/server';
import { verifyRequestAuth, adminDb } from '@/lib/firebase/admin';
import { getTutorModel } from '@/lib/gemini/client';
import { buildTutorSystemPrompt } from '@/lib/gemini/prompts';
import { checkSubjectRelevance } from '@/lib/gemini/relevance';
import { validateQuestionFormat } from '@/lib/usage/validation';
import { checkAndConsumeUsage } from '@/lib/usage/dailyLimit';
import { buildCacheKey, getCachedAnswer, recordCacheHit, setCachedAnswer } from '@/lib/cache/tutorCache';
import { stripUndefined } from '@/lib/utils/firestore';
import { hasImmediateSafetyConcern } from '@/lib/safety/crisis';
import { createGuardianSandboxEvent } from '@/lib/safety/guardianEvent';
import type { ChatMessage, ExplainLevel, Language, TutorSession } from '@/lib/types';

export const runtime = 'nodejs';

interface RequestBody {
  sessionId?: string; // omit to start a new session
  message: string;
  level: ExplainLevel;
  language: Language;
  subject?: string;
  chapter?: string;
  grade?: number;
  board?: TutorSession['board'];
}

// STREAMING CONTRACT: the response body is the plain-text answer, streamed
// chunk by chunk. Headers carry metadata that would otherwise require
// waiting for the stream to finish:
//   X-Session-Id            new or existing session id
//   X-Remaining-Questions   quota remaining AFTER this request, for the
//                           "Questions Left Today: X/20" display to update
//                           without a second round-trip
//   X-Cache-Hit             'true' if this answer was reused from cache
// Non-2xx responses are plain JSON: { error, code, retryAfterMs? }

function encoder() {
  return new TextEncoder();
}

export async function POST(req: NextRequest) {
  const decoded = await verifyRequestAuth(req.headers.get('authorization'));
  if (!decoded) {
    return Response.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
  }

  const body: RequestBody = await req.json();
  if (!body.message?.trim()) {
    return Response.json({ error: 'message is required', code: 'invalid_input' }, { status: 400 });
  }

  // This server-side gate cannot be bypassed by a modified browser client.
  // It stops the normal Tutor flow before any cache, AI, or session write.
  if (hasImmediateSafetyConcern(body.message)) {
    await createGuardianSandboxEvent(decoded.uid, body.message);
    return Response.json({ error: 'Immediate safety support is required.', code: 'immediate_safety_concern' }, { status: 400 });
  }

  // --- 1. Free, local, instant checks — reject obvious junk before any
  // Firestore write or Gemini call happens at all. ---
  const format = validateQuestionFormat(body.message);
  if (!format.valid) {
    return Response.json({ error: format.reason, code: 'invalid_input' }, { status: 400 });
  }

  const db = adminDb();

  try {
    // --- 2. Daily quota + cooldown, atomically checked AND consumed. A
    // question counts against the quota here regardless of what happens next
    // (cache hit, off-topic rejection, or a real Gemini call) — the quota is
    // about fair usage of the tutor as a whole, not just Gemini cost. ---
    const usage = await checkAndConsumeUsage(db, decoded.uid);
    if (!usage.allowed) {
      return Response.json(
        { error: usage.message, code: usage.reason, retryAfterMs: usage.retryAfterMs, remaining: usage.remaining },
        { status: 429 }
      );
    }

    const now = Date.now();
    let session: TutorSession;
    let sessionRef;

    if (body.sessionId) {
      sessionRef = db.collection('tutorSessions').doc(body.sessionId);
      const snap = await sessionRef.get();
      if (!snap.exists || snap.data()?.studentId !== decoded.uid) {
        return Response.json({ error: 'Session not found', code: 'not_found' }, { status: 404 });
      }
      session = snap.data() as TutorSession;
    } else {
      const profileSnap = await db.collection('users').doc(decoded.uid).get();
      sessionRef = db.collection('tutorSessions').doc();
      session = {
        id: sessionRef.id,
        studentId: decoded.uid,
        schoolId: profileSnap.data()?.schoolId || '',
        subject: body.subject || 'General',
        chapter: body.chapter,
        board: body.board || 'CBSE',
        grade: body.grade || 10,
        messages: [],
        conceptsCovered: [],
        createdAt: now,
        updatedAt: now,
      };
    }

    const isFreshQuestion = session.messages.length === 0;
    const cacheKey = isFreshQuestion
      ? buildCacheKey({
          board: session.board,
          grade: session.grade,
          subject: session.subject,
          chapter: session.chapter,
          level: body.level,
          language: body.language,
          question: body.message,
        })
      : null;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: body.message,
      inputMode: 'text',
      explainLevel: body.level,
      language: body.language,
      subject: body.subject,
      chapter: body.chapter,
      createdAt: now,
    };

    // --- 3. Cache lookup — only for a brand-new doubt (see tutorCache.ts for
    // why this doesn't apply mid-conversation). A hit skips Gemini entirely. ---
    if (cacheKey) {
      const cached = await getCachedAnswer(db, cacheKey);
      if (cached) {
        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: cached.answer,
          inputMode: 'text',
          explainLevel: body.level,
          language: body.language,
          subject: body.subject,
          chapter: body.chapter,
          createdAt: Date.now(),
        };
        session.messages.push(userMessage, assistantMessage);
        session.updatedAt = Date.now();
        await Promise.all([sessionRef.set(stripUndefined(session), { merge: true }), recordCacheHit(db, cacheKey)]);

        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder().encode(cached.answer));
            controller.close();
          },
        });
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Session-Id': session.id,
            'X-Remaining-Questions': String(usage.remaining),
            'X-Cache-Hit': 'true',
          },
        });
      }
    }

    // --- 4. Subject-relevance check — cheap Gemini Flash call, only for a
    // fresh doubt (mid-conversation relevance is contextual and already
    // handled by the main system prompt's own boundaries). ---
    if (isFreshQuestion && session.subject !== 'General study') {
      const { relevant } = await checkSubjectRelevance({
        question: body.message,
        subject: session.subject,
        chapter: session.chapter,
        grade: session.grade,
      });
      if (!relevant) {
        return Response.json(
          {
            error: `That doesn't look related to ${session.subject}${session.chapter ? ` — ${session.chapter}` : ''}. Try rephrasing, or pick the right subject/chapter above.`,
            code: 'off_topic',
            remaining: usage.remaining,
          },
          { status: 400 }
        );
      }
    }

    // --- 5. Only now, after every check above has passed, do we spend a
    // real Gemini call. ---
    const model = getTutorModel();
    const systemPrompt = buildTutorSystemPrompt({
      level: body.level,
      language: body.language,
      board: session.board,
      grade: session.grade,
      subject: session.subject,
    });

    const history = session.messages.map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('model' as const),
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({
      history,
      systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
    });

    const streamResult = await chat.sendMessageStream(body.message);
    const enc = encoder();

    const stream = new ReadableStream({
      async start(controller) {
        let fullText = '';
        try {
          for await (const chunk of streamResult.stream) {
            const text = chunk.text();
            fullText += text;
            controller.enqueue(enc.encode(text));
          }
        } catch (err) {
          controller.error(err);
          return;
        }

        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: fullText,
          inputMode: 'text',
          explainLevel: body.level,
          language: body.language,
          subject: body.subject,
          chapter: body.chapter,
          createdAt: Date.now(),
        };
        session.messages.push(userMessage, assistantMessage);
        session.updatedAt = Date.now();

        const writes: Promise<unknown>[] = [sessionRef.set(stripUndefined(session), { merge: true })];
        if (cacheKey) {
          writes.push(
            setCachedAnswer(db, cacheKey, fullText, {
              board: session.board,
              grade: session.grade,
              subject: session.subject,
              chapter: session.chapter,
              level: body.level,
              language: body.language,
              question: body.message,
            })
          );
        }
        await Promise.all(writes);

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Session-Id': session.id,
        'X-Remaining-Questions': String(usage.remaining),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    // Now catches EVERYTHING in this route — session creation, cache
    // lookups, and the relevance check were previously unprotected and
    // could crash with zero error handling, same class of bug as the
    // study-plan route. Logged server-side AND returned to the client, so
    // the real cause is visible in both places instead of disappearing
    // into a generic unparseable 500.
    console.error('[/api/tutor] failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json(
      { error: `Tutor request failed: ${message}`, code: 'tutor_error' },
      { status: 500 }
    );
  }
}
