import { NextRequest } from 'next/server';
import { verifyRequestAuth, adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';

type Leader = {
  rank: number;
  studentId: string;
  name: string;
  score: number;
  averageAccuracy: number;
  quizzesCompleted: number;
};

export async function GET(req: NextRequest) {
  const decoded = await verifyRequestAuth(req.headers.get('authorization'));
  if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const db = adminDb();
    const attempts = await db.collection('quizAttempts').where('submittedAt', '>=', monthStart).get();
    const totals = new Map<string, { accuracyTotal: number; quizzesCompleted: number }>();
    attempts.docs.forEach((item) => {
      const data = item.data() as { studentId: string; score: number };
      const current = totals.get(data.studentId) || { accuracyTotal: 0, quizzesCompleted: 0 };
      current.accuracyTotal += data.score;
      current.quizzesCompleted += 1;
      totals.set(data.studentId, current);
    });

    // A minimum prevents a student who scores 100% on a single easy quiz from
    // winning over a student who has demonstrated consistent performance.
    const eligible = [...totals.entries()].filter(([, value]) => value.quizzesCompleted >= 3);
    const withProfiles = await Promise.all(eligible.map(async ([studentId, value]) => {
      const profile = await db.collection('users').doc(studentId).get();
      const averageAccuracy = Math.round(value.accuracyTotal / value.quizzesCompleted);
      return {
        studentId,
        name: profile.data()?.name || 'VidyaAI student',
        averageAccuracy,
        quizzesCompleted: value.quizzesCompleted,
        // Accuracy matters most; consistency is a small bonus, capped so
        // students cannot win merely by repeatedly attempting easy quizzes.
        score: averageAccuracy * 10 + Math.min(value.quizzesCompleted, 20),
      };
    }));
    const leaders: Leader[] = withProfiles
      .sort((a, b) => b.score - a.score || b.averageAccuracy - a.averageAccuracy || b.quizzesCompleted - a.quizzesCompleted)
      .slice(0, 50)
      .map((leader, index) => ({ ...leader, rank: index + 1 }));

    return Response.json({ leaders, monthStart });
  } catch (error) {
    console.error('[/api/leaderboard] failed:', error);
    return Response.json({ error: 'Could not load the leaderboard.' }, { status: 500 });
  }
}
