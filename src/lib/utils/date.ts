/**
 * Returns the timestamp for the most recent Sunday 00:00:00 (start of week),
 * in the server/browser's local timezone. Used as the canonical "weekOf" key
 * across studyPlans and analyticsSnapshots — every part of the system must
 * compute this the same way or documents won't line up.
 */
export function startOfWeek(ts: number): number {
  const d = new Date(ts);
  const day = d.getDay(); // 0 = Sunday
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.getTime();
}

export function startOfPreviousWeek(ts: number): number {
  return startOfWeek(ts) - 7 * 86400000;
}
