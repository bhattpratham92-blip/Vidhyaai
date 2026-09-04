import { NextRequest } from 'next/server';
import { adminDb, verifyRequestAuth } from '@/lib/firebase/admin';
import { startOfWeek, startOfPreviousWeek } from '@/lib/utils/date';
import type {
  ConceptMastery,
  Quiz,
  QuizAttempt,
  StudentAnalyticsSnapshot,
  TutorSession,
  UserProfile,
} from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60; // this can take a while across many students

// TRIGGERED TWO WAYS:
// 1. Vercel Cron (see vercel.json) — when a CRON_SECRET env var is set,
//    Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` on
//    cron-triggered requests. No secret needs to live in vercel.json itself.
// 2. Manually by a teacher/school_admin — send a real Firebase ID token
//    instead, useful for testing without waiting for the weekly schedule.
//
// WHY THIS EXISTS AS A ROUTE, NOT A FIREBASE CLOUD FUNCTION: scheduled Cloud
// Functions require the Blaze (pay-as-you-go) plan even for trivial workloads.
// Vercel Cron hitting a route you're already deploying needs zero extra
// infrastructure or billing tier — same result, simpler stack.

interface AuthResult {
  authorized: boolean;
  scopeToSchoolId?: string; // set when a teacher triggers this manually — limits the rollup to their school. Unset for the cron-triggered whole-platform run.
}

async function checkAuthorization(req: NextRequest): Promise<AuthResult> {
  const authHeader = req.headers.get('authorization');
  const bearerValue = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1] : null;

  // Case 1: Vercel Cron's own secret — processes every school on the platform.
  if (bearerValue && process.env.CRON_SECRET && bearerValue === process.env.CRON_SECRET) {
    return { authorized: true };
  }

  // Case 2: a real teacher/school_admin manually triggering a rollup —
  // scoped to their own school only.
  const decoded = await verifyRequestAuth(authHeader);
  if (!decoded) return { authorized: false };
  const profileSnap = await adminDb().collection('users').doc(decoded.uid).get();
  const profile = profileSnap.data() as UserProfile | undefined;
  if (profile?.role === 'teacher' || profile?.role === 'school_admin') {
    return { authorized: true, scopeToSchoolId: profile.schoolId };
  }
  return { authorized: false };
}

function average(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

async function rollupStudent(studentId: string, schoolId: string) {
  const db = adminDb();
  const now = Date.now();
  const weekOf = startOfWeek(now);
  const weekEnd = weekOf + 7 * 86400000;
  const prevWeekOf = startOfPreviousWeek(now);

  // --- Quiz attempts this week ---
  const attemptsSnap = await db
    .collection('quizAttempts')
    .where('studentId', '==', studentId)
    .where('submittedAt', '>=', weekOf)
    .where('submittedAt', '<', weekEnd)
    .get();
  const attempts = attemptsSnap.docs.map((d) => d.data() as QuizAttempt);

  // Need each attempt's quiz to know the subject (attempts don't store it
  // directly — subject lives on the Quiz doc). Fetch the unique quizzes.
  const quizIds = [...new Set(attempts.map((a) => a.quizId))];
  const quizzes = await Promise.all(
    quizIds.map((id) => db.collection('quizzes').doc(id).get())
  );
  const quizById = new Map(quizzes.map((q) => [q.id, q.data() as Quiz | undefined]));

  // --- Tutor sessions touched this week (for doubtsAsked / time proxy) ---
  const sessionsSnap = await db
    .collection('tutorSessions')
    .where('studentId', '==', studentId)
    .where('updatedAt', '>=', weekOf)
    .where('updatedAt', '<', weekEnd)
    .get();
  const sessions = sessionsSnap.docs.map((d) => d.data() as TutorSession);

  let doubtsAsked = 0;
  for (const s of sessions) {
    doubtsAsked += s.messages.filter(
      (m) => m.role === 'user' && m.createdAt >= weekOf && m.createdAt < weekEnd
    ).length;
  }

  // NOTE: we don't measure actual screen time (no client-side time tracking
  // yet), so this is a rough proxy, not a real number. Flagged clearly in
  // the dashboard copy — see ROADMAP.md if you want real time tracking.
  const timeSpentMinutes = doubtsAsked * 3 + attempts.length * 10;

  // --- Concept mastery: aggregate this week's attempts, then smooth against
  // last week's snapshot so one bad quiz doesn't wildly swing the number ---
  const thisWeekConcepts = new Map<string, { subject: string; correct: number; total: number }>();
  for (const attempt of attempts) {
    const quiz = quizById.get(attempt.quizId);
    for (const [concept, breakdown] of Object.entries(attempt.conceptBreakdown)) {
      const existing = thisWeekConcepts.get(concept) || {
        subject: quiz?.subject || 'Unknown',
        correct: 0,
        total: 0,
      };
      existing.correct += breakdown.correct;
      existing.total += breakdown.total;
      thisWeekConcepts.set(concept, existing);
    }
  }

  const prevSnapshotDoc = await db.collection('analyticsSnapshots').doc(`${studentId}_${prevWeekOf}`).get();
  const prevConceptMastery: ConceptMastery[] = prevSnapshotDoc.data()?.conceptMastery || [];
  const prevByConceptName = new Map(prevConceptMastery.map((c) => [c.concept, c]));

  const conceptMastery: ConceptMastery[] = [];
  const allConceptNames = new Set([...thisWeekConcepts.keys(), ...prevByConceptName.keys()]);

  for (const concept of allConceptNames) {
    const thisWeek = thisWeekConcepts.get(concept);
    const prev = prevByConceptName.get(concept);

    if (thisWeek && thisWeek.total > 0) {
      const thisWeekScore = (thisWeek.correct / thisWeek.total) * 100;
      // 60% weight on new data, 40% on history — recent performance matters
      // more, but one unlucky quiz doesn't erase weeks of prior mastery.
      const smoothed = prev ? thisWeekScore * 0.6 + prev.masteryScore * 0.4 : thisWeekScore;
      conceptMastery.push({
        concept,
        subject: thisWeek.subject,
        masteryScore: Math.round(smoothed),
        attemptsCount: (prev?.attemptsCount || 0) + thisWeek.total,
        lastPracticedAt: now,
      });
    } else if (prev) {
      // No new data this week — carry the concept forward unchanged rather
      // than dropping it, so old weak spots stay visible until re-practiced.
      conceptMastery.push(prev);
    }
  }

  // --- Strong/weak subjects, derived from this week's quiz scores by subject ---
  const scoresBySubject = new Map<string, number[]>();
  for (const attempt of attempts) {
    const subject = quizById.get(attempt.quizId)?.subject || 'Unknown';
    scoresBySubject.set(subject, [...(scoresBySubject.get(subject) || []), attempt.score]);
  }
  const strongSubjects: string[] = [];
  const weakSubjects: string[] = [];
  for (const [subject, scores] of scoresBySubject) {
    const avg = average(scores);
    if (avg >= 70) strongSubjects.push(subject);
    else if (avg < 50) weakSubjects.push(subject);
  }

  const snapshot: StudentAnalyticsSnapshot = {
    studentId,
    schoolId,
    weekOf,
    timeSpentMinutes,
    doubtsAsked,
    quizzesCompleted: attempts.length,
    avgQuizScore: average(attempts.map((a) => a.score)),
    conceptMastery,
    strongSubjects,
    weakSubjects,
  };

  await db.collection('analyticsSnapshots').doc(`${studentId}_${weekOf}`).set(snapshot);
  return snapshot;
}

export async function GET(req: NextRequest) {
  const auth = await checkAuthorization(req);
  if (!auth.authorized) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = adminDb();
    let studentsQuery = db.collection('users').where('role', '==', 'student');
    if (auth.scopeToSchoolId) {
      studentsQuery = studentsQuery.where('schoolId', '==', auth.scopeToSchoolId);
    }
    const studentsSnap = await studentsQuery.get();
    const students = studentsSnap.docs.map((d) => d.data() as UserProfile);

    const results = [];
    for (const student of students) {
      try {
        const snapshot = await rollupStudent(student.uid, student.schoolId);
        results.push({ studentId: student.uid, ok: true, doubtsAsked: snapshot.doubtsAsked });
      } catch (err) {
        results.push({ studentId: student.uid, ok: false, error: err instanceof Error ? err.message : 'unknown' });
      }
    }

    return Response.json({ processedCount: results.length, results });
  } catch (err) {
    console.error('[/api/analytics/rollup] failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}

// Allow POST too, for the manual teacher-triggered case (some clients prefer
// not to send auth headers on GET requests).
export const POST = GET;
