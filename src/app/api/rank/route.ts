import { NextRequest } from 'next/server';
import { verifyRequestAuth, adminDb } from '@/lib/firebase/admin';
import { startOfWeek } from '@/lib/utils/date';
import type { StudentAnalyticsSnapshot, UserProfile } from '@/lib/types';

export const runtime = 'nodejs';

// PRIVACY DESIGN: this computes rank across the requesting student's own
// classmates (same school, grade, and section/stream) entirely server-side
// with the Admin SDK, and returns ONLY the requester's own rank + class
// size — never classmates' names, uids, or scores. A student's own client
// never has access to other students' analyticsSnapshots (blocked by
// firestore.rules), so this had to be a dedicated endpoint rather than
// something computed client-side.

export async function GET(req: NextRequest) {
  const decoded = await verifyRequestAuth(req.headers.get('authorization'));
  if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = adminDb();
    const profileSnap = await db.collection('users').doc(decoded.uid).get();
    if (!profileSnap.exists) {
      return Response.json({ error: 'Profile not found' }, { status: 404 });
    }
    const profile = profileSnap.data() as UserProfile;
    if (profile.role !== 'student') {
      return Response.json({ error: 'Rank is only available for student accounts' }, { status: 403 });
    }

    // Fetch everyone in the same school + grade, then narrow to the same
    // stream (Class 11-12) or section (Class 1-10) in memory — Firestore
    // can't combine that many equality filters without an extra composite
    // index, and a single grade within one school is a small enough list
    // that filtering client-side (well, server-side here) is fine.
    const gradeMatesSnap = await db
      .collection('users')
      .where('schoolId', '==', profile.schoolId)
      .where('role', '==', 'student')
      .where('grade', '==', profile.grade)
      .get();

    const isSenior = (profile.grade || 0) >= 11;
    const classmates = gradeMatesSnap.docs
      .map((d) => d.data() as UserProfile)
      .filter((u) => (isSenior ? u.stream === profile.stream : u.section === profile.section));

    const weekOf = startOfWeek(Date.now());
    const scores = await Promise.all(
      classmates.map(async (u) => {
        const snap = await db.collection('analyticsSnapshots').doc(`${u.uid}_${weekOf}`).get();
        return snap.exists ? { uid: u.uid, score: (snap.data() as StudentAnalyticsSnapshot).avgQuizScore } : null;
      })
    );

    const withScores = scores.filter((s): s is { uid: string; score: number } => s !== null);
    const mine = withScores.find((s) => s.uid === decoded.uid);

    if (!mine || withScores.length < 2) {
      // Need at least 2 students with scores for "rank" to mean anything.
      return Response.json(
        { error: 'Not enough class data yet to compute a rank — check back once more classmates have taken quizzes.' },
        { status: 422 }
      );
    }

    const sorted = [...withScores].sort((a, b) => b.score - a.score);
    const rank = sorted.findIndex((s) => s.uid === decoded.uid) + 1;

    return Response.json({ rank, totalStudents: sorted.length, avgScore: mine.score });
  } catch (err) {
    console.error('[/api/rank] failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
