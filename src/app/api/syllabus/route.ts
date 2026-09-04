import { NextRequest } from 'next/server';
import { verifyRequestAuth, adminDb } from '@/lib/firebase/admin';
import { syllabusId } from '@/lib/utils/syllabus';
import type { Board } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const decoded = await verifyRequestAuth(req.headers.get('authorization'));
  if (!decoded) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const board = req.nextUrl.searchParams.get('board') as Board | null;
  const grade = req.nextUrl.searchParams.get('grade');
  const subject = req.nextUrl.searchParams.get('subject');

  if (!board || !grade || !subject) {
    return Response.json({ error: 'board, grade, and subject are required' }, { status: 400 });
  }

  try {
    const id = syllabusId(board, Number(grade), subject);
    const snap = await adminDb().collection('syllabus').doc(id).get();

    // Empty array (not an error) when nothing's been seeded for this
    // combination — the client falls back to free-text chapter entry, so an
    // un-seeded subject degrades gracefully instead of breaking.
    if (!snap.exists) {
      return Response.json({ chapters: [] });
    }

    return Response.json({ chapters: snap.data()?.chapters || [] });
  } catch (err) {
    console.error('[/api/syllabus] failed:', err);
    // Fail open with an empty list rather than a 500 — the ChapterPicker
    // component already handles "no syllabus data" gracefully by falling
    // back to free text, so a transient error here shouldn't block the
    // whole form.
    return Response.json({ chapters: [] });
  }
}
