import { NextRequest } from 'next/server';
import { verifyRequestAuth, adminDb } from '@/lib/firebase/admin';
import { getVisionModel } from '@/lib/gemini/client';
import { buildImageDoubtPrompt } from '@/lib/gemini/prompts';
import { checkAndConsumeUsage } from '@/lib/usage/dailyLimit';
import { stripUndefined } from '@/lib/utils/firestore';
import type { ChatMessage, ExplainLevel, Language, TutorSession } from '@/lib/types';

export const runtime = 'nodejs';

// Expects multipart/form-data: { image: File, level, language, subject?,
// grade?, board?, sessionId? }. The client uploads the image to Firebase
// Storage FIRST and passes the resulting imageUrl here — see
// components/tutor/ImageUpload.tsx. This route only ever receives a URL,
// keeping the request small and letting Storage handle large files.
//
// USAGE PROTECTION SCOPE: shares the exact same daily counter as the text
// route (/api/tutor) — a photo doubt counts the same as a typed one against
// the 20/day limit. Deliberately does NOT run validateQuestionFormat() (a
// photo isn't 10 characters of text) or the tutorCache/relevance checks
// (every photo is different; there's nothing meaningful to cache or
// pre-classify without an extra vision call, which isn't worth the cost —
// flagged as a gap in ROADMAP.md if photo-spam becomes a real problem).

interface RequestBody {
  imageUrl: string;
  imageBase64: string; // sent once for the Gemini call itself; not stored
  mimeType: string;
  level: ExplainLevel;
  language: Language;
  subject?: string;
  grade?: number;
  board?: TutorSession['board'];
  sessionId?: string;
}

export async function POST(req: NextRequest) {
  const decoded = await verifyRequestAuth(req.headers.get('authorization'));
  if (!decoded) {
    return Response.json({ error: 'Unauthorized', code: 'unauthorized' }, { status: 401 });
  }

  const body: RequestBody = await req.json();
  if (!body.imageBase64) {
    return Response.json({ error: 'imageBase64 is required', code: 'invalid_input' }, { status: 400 });
  }

  const db = adminDb();

  try {
    const usage = await checkAndConsumeUsage(db, decoded.uid);
    if (!usage.allowed) {
      return Response.json(
        { error: usage.message, code: usage.reason, retryAfterMs: usage.retryAfterMs, remaining: usage.remaining },
        { status: 429 }
      );
    }

    const now = Date.now();

    let sessionRef;
    let session: TutorSession;

    if (body.sessionId) {
      sessionRef = db.collection('tutorSessions').doc(body.sessionId);
      const snap = await sessionRef.get();
      if (!snap.exists || snap.data()?.studentId !== decoded.uid) {
        return Response.json({ error: 'Session not found' }, { status: 404 });
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
        board: body.board || 'CBSE',
        grade: body.grade || 10,
        messages: [],
        conceptsCovered: [],
        createdAt: now,
        updatedAt: now,
      };
    }

    const model = getVisionModel();
    const prompt = buildImageDoubtPrompt({
      level: body.level,
      language: body.language,
      board: session.board,
      grade: session.grade,
    });

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: body.imageBase64, mimeType: body.mimeType } },
    ]);
    const responseText = result.response.text();

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: '[Image doubt uploaded]',
      inputMode: 'image',
      imageUrl: body.imageUrl,
      explainLevel: body.level,
      language: body.language,
      subject: body.subject,
      createdAt: now,
    };

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: responseText,
      inputMode: 'image',
      explainLevel: body.level,
      language: body.language,
      subject: body.subject,
      createdAt: Date.now(),
    };

    session.messages.push(userMessage, assistantMessage);
    session.updatedAt = Date.now();
    await sessionRef.set(stripUndefined(session), { merge: true });

    return Response.json({
      sessionId: session.id,
      message: assistantMessage,
      remaining: usage.remaining,
    });
  } catch (err) {
    console.error('[/api/tutor/image] failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: `Image doubt failed: ${message}`, code: 'image_error' }, { status: 500 });
  }
}
