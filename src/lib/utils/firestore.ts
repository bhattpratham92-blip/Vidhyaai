/**
 * Firestore's Admin SDK throws if ANY field in a document is explicitly
 * `undefined` (as opposed to simply not being present at all) — e.g.
 * `{ chapter: undefined }` fails, but `{}` (no chapter key) is fine. Optional
 * fields across this app (ChatMessage.chapter, TutorSession.chapter, etc.)
 * naturally end up as `undefined` when the client doesn't send them, so
 * every write needs this pass first rather than fixing each call site by
 * hand and risking missing one.
 *
 * Recurses into nested objects and arrays (e.g. TutorSession.messages) so
 * it's safe to call on an entire document right before `.set()`.
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val !== undefined) {
        result[key] = stripUndefined(val);
      }
    }
    return result as T;
  }
  return value;
}
