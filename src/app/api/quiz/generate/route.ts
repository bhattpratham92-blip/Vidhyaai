import { NextRequest } from 'next/server';
import { verifyRequestAuth, adminDb } from '@/lib/firebase/admin';
import { getGenerationModel } from '@/lib/gemini/client';
import { buildQuizGenerationPrompt } from '@/lib/gemini/prompts';
import { parseGeminiJson } from '@/lib/gemini/parseJson';
import { stripUndefined } from '@/lib/utils/firestore';
import type { Board, Quiz } from '@/lib/types';

export const runtime = 'nodejs';

interface RequestBody {
  subject: string;
  chapter: string;
  grade: number;
  board: Board;
  questionCount?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  types?: string[];
}

interface ParsedQuiz {
  title: string;
  questions: Record<string, unknown>[];
}

export async function POST(req: NextRequest) {
  const decoded = await verifyRequestAuth(req.headers.get('authorization'));
  if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body: RequestBody = await req.json();
  if (!body.subject || !body.chapter) {
    return Response.json({ error: 'subject and chapter are required' }, { status: 400 });
  }

  const db = adminDb();

  try {
    const model = getGenerationModel();
    const prompt = buildQuizGenerationPrompt({
      subject: body.subject,
      chapter: body.chapter,
      grade: body.grade,
      board: body.board,
      questionCount: body.questionCount || 10,
      difficulty: body.difficulty,
      types: body.types,
    });

    const result = await model.generateContent(prompt);
    const parsed = parseGeminiJson<ParsedQuiz>(result.response.text());

    const quizRef = db.collection('quizzes').doc();

    const quiz: Quiz = {
      id: quizRef.id,
      title: parsed.title,
      subject: body.subject,
      chapter: body.chapter,
      grade: body.grade,
      board: body.board,
      questions: parsed.questions.map((q) => ({
        ...q,
        id: crypto.randomUUID(),
      })) as Quiz['questions'],
      createdBy: decoded.uid,
      assignedTo: [],
      createdAt: Date.now(),
    };

    await quizRef.set(stripUndefined(quiz));
    return Response.json({ quiz });
  } catch (err) {
    console.error('[/api/quiz/generate] failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error generating the quiz';
    return Response.json({ error: message, code: 'generation_failed' }, { status: 500 });
  }
}
