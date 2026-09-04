import { NextRequest } from 'next/server';
import { verifyRequestAuth, adminDb } from '@/lib/firebase/admin';
import { getGenerationModel } from '@/lib/gemini/client';
import { buildNotesGenerationPrompt } from '@/lib/gemini/prompts';
import { parseGeminiJson } from '@/lib/gemini/parseJson';
import type { Board, ChapterNote, Language } from '@/lib/types';

export const runtime = 'nodejs';

interface RequestBody {
  subject: string;
  chapter: string;
  grade: number;
  board: Board;
  language: Language;
}

interface ParsedNote {
  summary: string;
  keyPoints: string[];
  formulas?: string[];
  diagramsDescribed?: string[];
}

export async function POST(req: NextRequest) {
  const decoded = await verifyRequestAuth(req.headers.get('authorization'));
  if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body: RequestBody = await req.json();
  if (!body.subject || !body.chapter) {
    return Response.json({ error: 'subject and chapter are required' }, { status: 400 });
  }

  const db = adminDb();

  // Cache check: notes are expensive to regenerate and identical for every
  // student on the same board/grade/chapter, so reuse a shared copy when one
  // already exists rather than calling Gemini again.
  const cacheId = `${body.board}_${body.grade}_${body.subject}_${body.chapter}_${body.language}`
    .replace(/\s+/g, '-')
    .toLowerCase();
  const cacheRef = db.collection('chapterNotes').doc(cacheId);

  try {
    const cached = await cacheRef.get();
    if (cached.exists) {
      return Response.json({ note: cached.data() });
    }

    const model = getGenerationModel();
    const prompt = buildNotesGenerationPrompt(body);
    const result = await model.generateContent(prompt);
    const parsed = parseGeminiJson<ParsedNote>(result.response.text());

    const note: ChapterNote = {
      id: cacheId,
      subject: body.subject,
      chapter: body.chapter,
      grade: body.grade,
      board: body.board,
      language: body.language,
      summary: parsed.summary,
      keyPoints: parsed.keyPoints || [],
      formulas: parsed.formulas || [],
      diagramsDescribed: parsed.diagramsDescribed || [],
      generatedFor: 'shared',
      createdAt: Date.now(),
    };

    await cacheRef.set(note);
    return Response.json({ note });
  } catch (err) {
    console.error('[/api/notes/generate] failed:', err);
    const message = err instanceof Error ? err.message : 'Unknown error generating notes';
    return Response.json({ error: message, code: 'generation_failed' }, { status: 500 });
  }
}
