import { NextRequest } from 'next/server';
import { verifyRequestAuth, adminDb } from '@/lib/firebase/admin';
import type { Quiz, QuizAttempt, QuizQuestion } from '@/lib/types';

export const runtime = 'nodejs';

interface RequestBody {
  quizId: string;
  answers: Record<string, string>; // questionId -> student's answer
  startedAt: number;
}

// AUTO-GRADING SCOPE: mcq, true_false, and fill_blank are graded by exact
// (case-insensitive, trimmed) match against correctAnswer. short_answer and
// long_answer are NOT reliably auto-gradable with string matching — they're
// recorded and returned with the AI's model explanation so the student can
// self-assess, but they're excluded from the numeric score. Upgrading these
// to AI-graded (compare meaning, not exact text) is flagged in ROADMAP.md.

function isAutoGradable(type: QuizQuestion['type']) {
  return type === 'mcq' || type === 'true_false' || type === 'fill_blank';
}

function normalize(s: string) {
  return s.trim().toLowerCase();
}

export async function POST(req: NextRequest) {
  const decoded = await verifyRequestAuth(req.headers.get('authorization'));
  if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body: RequestBody = await req.json();
  if (!body.quizId || !body.answers) {
    return Response.json({ error: 'quizId and answers are required' }, { status: 400 });
  }

  try {
    const db = adminDb();
    const [quizSnap, profileSnap] = await Promise.all([
      db.collection('quizzes').doc(body.quizId).get(),
      db.collection('users').doc(decoded.uid).get(),
    ]);
    if (!quizSnap.exists) {
      return Response.json({ error: 'Quiz not found' }, { status: 404 });
    }
    const quiz = quizSnap.data() as Quiz;

    let correctCount = 0;
    let autoGradableCount = 0;
    const conceptBreakdown: Record<string, { correct: number; total: number }> = {};
    const results = quiz.questions.map((q) => {
      const studentAnswer = body.answers[q.id] ?? '';
      let isCorrect: boolean | null = null;

      if (isAutoGradable(q.type)) {
        autoGradableCount++;
        isCorrect = normalize(studentAnswer) === normalize(q.correctAnswer);
        if (isCorrect) correctCount++;

        if (!conceptBreakdown[q.concept]) conceptBreakdown[q.concept] = { correct: 0, total: 0 };
        conceptBreakdown[q.concept].total++;
        if (isCorrect) conceptBreakdown[q.concept].correct++;
      }

      return {
        questionId: q.id,
        studentAnswer,
        isCorrect, // null = not auto-gradable, self-assess using explanation
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        concept: q.concept,
      };
    });

    const score = autoGradableCount > 0 ? Math.round((correctCount / autoGradableCount) * 100) : 0;

    const attempt: QuizAttempt = {
      id: crypto.randomUUID(),
      quizId: body.quizId,
      studentId: decoded.uid,
      schoolId: profileSnap.data()?.schoolId || '',
      answers: body.answers,
      score,
      conceptBreakdown,
      startedAt: body.startedAt,
      submittedAt: Date.now(),
    };

    await db.collection('quizAttempts').doc(attempt.id).set(attempt);

    return Response.json({
      attempt,
      results,
      autoGradableCount,
      ungradedCount: quiz.questions.length - autoGradableCount,
    });
  } catch (err) {
    console.error('[/api/quiz/attempt] failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error grading the quiz';
    return Response.json({ error: message }, { status: 500 });
  }
}
