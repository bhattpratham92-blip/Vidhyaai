import { NextRequest } from 'next/server';
import { verifyRequestAuth, adminDb } from '@/lib/firebase/admin';
import { getTutorModel } from '@/lib/gemini/client';
import { buildParentDigestPrompt } from '@/lib/gemini/prompts';
import { startOfWeek } from '@/lib/utils/date';
import type { Language, StudentAnalyticsSnapshot, UserProfile } from '@/lib/types';

export const runtime = 'nodejs';

interface RequestBody {
  childId: string;
  language?: Language;
}

export async function POST(req: NextRequest) {
  const decoded = await verifyRequestAuth(req.headers.get('authorization'));
  if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body: RequestBody = await req.json();
  if (!body.childId) return Response.json({ error: 'childId is required' }, { status: 400 });

  try {
    const db = adminDb();
    const requesterSnap = await db.collection('users').doc(decoded.uid).get();
    const requester = requesterSnap.data() as UserProfile | undefined;

    // Two valid ways to request this digest:
    // 1. Self-view — a student's own account, viewed through "Parent view" at
    //    login (the primary path now; no separate parent account needed).
    // 2. A genuinely separate parent account still linked via childIds
    //    (older flow, kept for backward compatibility).
    const isSelfView = decoded.uid === body.childId;
    const isLinkedParent = requester?.childIds?.includes(body.childId);
    if (!isSelfView && !isLinkedParent) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const weekOf = startOfWeek(Date.now());
    const [studentSnap, snapshotSnap] = await Promise.all([
      db.collection('users').doc(body.childId).get(),
      db.collection('analyticsSnapshots').doc(`${body.childId}_${weekOf}`).get(),
    ]);

    if (!studentSnap.exists) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }
    const student = studentSnap.data() as UserProfile;

    if (!snapshotSnap.exists) {
      return Response.json(
        { error: 'No activity data for this week yet — check back after using the tutor or taking a quiz.' },
        { status: 422 }
      );
    }
    const snapshot = snapshotSnap.data() as StudentAnalyticsSnapshot;

    const weekOfLabel = new Date(weekOf).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

    const model = getTutorModel();
    const prompt = buildParentDigestPrompt({
      studentName: student.name,
      weekOf: weekOfLabel,
      doubtsAsked: snapshot.doubtsAsked,
      quizzesCompleted: snapshot.quizzesCompleted,
      avgQuizScore: snapshot.avgQuizScore,
      strongSubjects: snapshot.strongSubjects,
      weakSubjects: snapshot.weakSubjects,
      language: body.language || requester?.preferredLanguage || 'en',
    });

    const result = await model.generateContent(prompt);
    const digest = result.response.text();

    return Response.json({ digest, snapshot, weekOfLabel });
  } catch (err) {
    console.error('[/api/parent/digest] failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error generating the digest';
    return Response.json({ error: message }, { status: 500 });
  }
}
