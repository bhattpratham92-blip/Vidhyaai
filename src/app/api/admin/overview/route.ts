import { NextRequest } from 'next/server';
import { adminDb, verifyRequestAuth } from '@/lib/firebase/admin';

export const runtime = 'nodejs';

async function requireAdmin(req: NextRequest) {
  const decoded = await verifyRequestAuth(req.headers.get('authorization'));
  if (!decoded) return null;
  const profile = await adminDb().collection('users').doc(decoded.uid).get();
  return profile.data()?.role === 'school_admin' ? decoded : null;
}

export async function GET(req: NextRequest) {
  try {
    if (!await requireAdmin(req)) return Response.json({ error: 'Admin access required.' }, { status: 403 });
    const db = adminDb();
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const [students, bookingsSnap, attempts] = await Promise.all([
      db.collection('users').where('role', '==', 'student').count().get(),
      db.collection('counselingBookings').orderBy('createdAt', 'desc').limit(50).get(),
      db.collection('quizAttempts').where('submittedAt', '>=', monthStart).get(),
    ]);

    const bookingRows = await Promise.all(bookingsSnap.docs.map(async (item) => {
      const booking = item.data();
      const student = await db.collection('users').doc(booking.studentId).get();
      return {
        id: item.id,
        studentName: student.data()?.name || 'Unknown student',
        format: booking.format,
        preferredDate: booking.preferredDate,
        preferredTime: booking.preferredTime,
        concern: booking.concern,
        status: booking.status,
        createdAt: booking.createdAt,
      };
    }));

    const totals = new Map<string, { score: number; quizzes: number }>();
    attempts.docs.forEach((item) => {
      const data = item.data() as { studentId: string; score: number };
      const current = totals.get(data.studentId) || { score: 0, quizzes: 0 };
      totals.set(data.studentId, { score: current.score + data.score, quizzes: current.quizzes + 1 });
    });
    const eligible = [...totals.entries()].filter(([, value]) => value.quizzes >= 3);
    const leaders = await Promise.all(eligible.map(async ([studentId, value]) => {
      const student = await db.collection('users').doc(studentId).get();
      const averageAccuracy = Math.round(value.score / value.quizzes);
      return { studentId, name: student.data()?.name || 'VidyaAI student', averageAccuracy, quizzesCompleted: value.quizzes, score: averageAccuracy * 10 + Math.min(value.quizzes, 20) };
    }));
    const leaderboard = leaders
      .sort((a, b) => b.score - a.score || b.averageAccuracy - a.averageAccuracy || b.quizzesCompleted - a.quizzesCompleted)
      .slice(0, 3)
      .map((leader, index) => ({ ...leader, rank: index + 1 }));

    return Response.json({
      students: students.data().count,
      counselingRequests: bookingRows.length,
      requestedSessions: bookingRows.filter((booking) => booking.status === 'requested').length,
      completedSessions: bookingRows.filter((booking) => booking.status === 'completed').length,
      quizAttempts: attempts.size,
      monthStart,
      bookings: bookingRows,
      leaderboard,
    });
  } catch (error) {
    console.error('[/api/admin/overview] failed:', error);
    return Response.json({ error: 'Could not load the admin overview.' }, { status: 500 });
  }
}
