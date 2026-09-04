import { createHash } from 'crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { normalizeQuestion } from '@/lib/usage/validation';
import type { Board, ExplainLevel, Language } from '@/lib/types';

// SCOPE OF THIS CACHE: only applies to the FIRST message of a brand-new
// doubt-solving session (no prior conversation history). Once a student is
// mid-conversation, the same question text can need a different answer
// depending on what was already said — caching there would return stale or
// contextually-wrong responses. A fresh "why does ice float on water" asked
// by 50 different students in the same week, on the other hand, genuinely
// has the same best answer, and reusing it is real, safe savings.
//
// The cache is shared ACROSS students (like chapterNotes), not per-student —
// deliberately, since the whole point is "don't pay Gemini twice for the
// same question."

interface CacheParams {
  board: Board;
  grade: number;
  subject: string;
  chapter?: string;
  level: ExplainLevel;
  language: Language;
  question: string;
}

interface CachedAnswer {
  answer: string;
  hitCount: number;
  createdAt: number;
  lastHitAt: number;
}

export function buildCacheKey(params: CacheParams): string {
  const normalized = normalizeQuestion(params.question);
  const raw = [
    params.board,
    params.grade,
    params.subject,
    params.chapter || '',
    params.level,
    params.language,
    normalized,
  ].join('|');
  return createHash('sha256').update(raw).digest('hex');
}

export async function getCachedAnswer(db: Firestore, cacheKey: string): Promise<CachedAnswer | null> {
  const snap = await db.collection('tutorCache').doc(cacheKey).get();
  return snap.exists ? (snap.data() as CachedAnswer) : null;
}

export async function recordCacheHit(db: Firestore, cacheKey: string): Promise<void> {
  await db.collection('tutorCache').doc(cacheKey).update({
    hitCount: FieldValue.increment(1),
    lastHitAt: Date.now(),
  });
}

export async function setCachedAnswer(
  db: Firestore,
  cacheKey: string,
  answer: string,
  params: CacheParams
): Promise<void> {
  const now = Date.now();
  await db.collection('tutorCache').doc(cacheKey).set({
    answer,
    subject: params.subject,
    chapter: params.chapter || null,
    grade: params.grade,
    board: params.board,
    hitCount: 0,
    createdAt: now,
    lastHitAt: now,
  });
}
