/**
 * Gemini is asked to return raw JSON (no markdown fences, no commentary) in
 * every prompt that uses this, and `responseMimeType: 'application/json'`
 * is set on the model config too — but neither is a hard guarantee. Every
 * route that skipped this and called `JSON.parse(result.response.text())`
 * directly was one slightly-off Gemini response away from crashing
 * unhandled, which sends the client a non-JSON error page instead of a
 * real error message — that's the exact "SyntaxError: The string did not
 * match the expected pattern" Safari shows when it tries to parse an HTML
 * error page as JSON.
 *
 * This strips common wrapper patterns (```json fences, stray leading/
 * trailing text) before parsing, and throws a clear, specific error if it
 * still can't parse — which the calling route's try/catch turns into a
 * real JSON error response instead of a crash.
 */
export function parseGeminiJson<T>(rawText: string): T {
  let text = rawText.trim();

  // Strip ```json ... ``` or ``` ... ``` wrapper if the model added one
  // despite being told not to.
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      'The AI response could not be parsed. This is usually a temporary issue — try again.'
    );
  }
}
