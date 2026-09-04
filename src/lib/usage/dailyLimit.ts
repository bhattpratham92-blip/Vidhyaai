import type { Firestore } from 'firebase-admin/firestore';

export const DAILY_QUESTION_LIMIT = 20;
export const COOLDOWN_MS = 5000;

// Doc id is `${studentId}_${dateKey}` — a new day automatically means a new
// document, so the count "resets" for free with zero cron job or scheduled
// reset logic needed. Old counters just accumulate; see note in ROADMAP.md
// about setting a Firestore TTL policy on `expireAt` to auto-clean them up.

interface UsageCounterDoc {
  studentId: string;
  dateKey: string;
  questionCount: number;
  lastQuestionAt: number;
  expireAt: number;
}

/** Returns today's date as YYYY-MM-DD in Indian Standard Time — deliberately
 * not the server's local time or UTC, since "resets every day" should mean
 * midnight for the schools actually using this, not midnight in whatever
 * timezone Vercel's servers happen to run in. */
export function getISTDateKey(ts: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ts)); // en-CA locale conveniently formats as YYYY-MM-DD
}

export interface UsageCheckResult {
  allowed: boolean;
  remaining: number;
  reason?: 'cooldown' | 'limit_reached';
  message?: string;
  retryAfterMs?: number;
}

/**
 * Atomically checks AND consumes one question against the student's daily
 * quota, in a single transaction so two near-simultaneous requests (e.g. a
 * flaky client double-submitting) can't both slip through at count 19→20.
 * Call this ONLY after validateQuestionFormat() has already passed — no
 * point spending a Firestore transaction on input we're going to reject
 * anyway.
 */
export async function checkAndConsumeUsage(db: Firestore, studentId: string): Promise<UsageCheckResult> {
  const now = Date.now();
  const dateKey = getISTDateKey(now);
  const ref = db.collection('usageCounters').doc(`${studentId}_${dateKey}`);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() as UsageCounterDoc) : null;

    if (data?.lastQuestionAt && now - data.lastQuestionAt < COOLDOWN_MS) {
      return {
        allowed: false,
        remaining: Math.max(0, DAILY_QUESTION_LIMIT - (data.questionCount || 0)),
        reason: 'cooldown' as const,
        message: 'Please wait a few seconds before asking another question.',
        retryAfterMs: COOLDOWN_MS - (now - data.lastQuestionAt),
      };
    }

    const currentCount = data?.questionCount || 0;
    if (currentCount >= DAILY_QUESTION_LIMIT) {
      return {
        allowed: false,
        remaining: 0,
        reason: 'limit_reached' as const,
        message: 'Daily AI limit reached. Please try again tomorrow.',
      };
    }

    const newCount = currentCount + 1;
    tx.set(
      ref,
      {
        studentId,
        dateKey,
        questionCount: newCount,
        lastQuestionAt: now,
        // 90-day TTL field. Configure a Firestore TTL policy on this field
        // (Firebase Console → Firestore → TTL Policies) to auto-delete old
        // counters — otherwise this collection grows forever, harmlessly
        // but needlessly.
        expireAt: now + 90 * 86400000,
      },
      { merge: true }
    );

    return { allowed: true, remaining: DAILY_QUESTION_LIMIT - newCount };
  });
}

/** Read-only usage check — does NOT consume a question. Used by the
 * "Questions Left Today: X/20" display and to decide whether to even show
 * the input as enabled, without it counting as an attempt. */
export async function getUsage(db: Firestore, studentId: string) {
  const dateKey = getISTDateKey(Date.now());
  const snap = await db.collection('usageCounters').doc(`${studentId}_${dateKey}`).get();
  const used = snap.exists ? (snap.data() as UsageCounterDoc).questionCount || 0 : 0;
  return { used, remaining: Math.max(0, DAILY_QUESTION_LIMIT - used), limit: DAILY_QUESTION_LIMIT };
}

// Wellbeing conversations have their own quota so a student can still use the
// tutor after reaching their wellbeing limit (and vice versa).
export async function checkAndConsumeWellbeingUsage(db: Firestore, studentId: string) {
  const now = Date.now();
  const dateKey = getISTDateKey(now);
  const ref = db.collection('wellbeingUsageCounters').doc(`${studentId}_${dateKey}`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? (snap.data() as UsageCounterDoc) : null;
    const currentCount = data?.questionCount || 0;
    if (currentCount >= DAILY_QUESTION_LIMIT) {
      return { allowed: false, remaining: 0, reason: 'limit_reached' as const, message: 'Daily wellbeing chat limit reached. Please try again tomorrow.' };
    }
    const newCount = currentCount + 1;
    tx.set(ref, { studentId, dateKey, questionCount: newCount, lastQuestionAt: now, expireAt: now + 90 * 86400000 }, { merge: true });
    return { allowed: true, remaining: DAILY_QUESTION_LIMIT - newCount };
  });
}

export async function getWellbeingUsage(db: Firestore, studentId: string) {
  const dateKey = getISTDateKey(Date.now());
  const snap = await db.collection('wellbeingUsageCounters').doc(`${studentId}_${dateKey}`).get();
  const used = snap.exists ? (snap.data() as UsageCounterDoc).questionCount || 0 : 0;
  return { used, remaining: Math.max(0, DAILY_QUESTION_LIMIT - used), limit: DAILY_QUESTION_LIMIT };
}
