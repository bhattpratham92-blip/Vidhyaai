export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

const MIN_CHARS = 10;
const MIN_WORDS = 3;

// Deliberately small and literal rather than a fuzzy/ML matcher — false
// positives here block a real student's real question, which is worse than
// occasionally letting a greeting through. Keep this list boring and exact.
const GREETINGS = [
  'hi', 'hii', 'hiii', 'hello', 'helo', 'hey', 'heyy', 'yo', 'sup',
  'good morning', 'good afternoon', 'good evening', 'good night',
  'how are you', "what's up", 'whats up', 'ok', 'okay', 'k', 'kk',
  'thanks', 'thank you', 'thx', 'bye', 'goodbye', 'test', 'testing',
  'asdf', 'asdfgh', 'qwerty', 'abc', 'abcd', '123', 'hello there',
];

function stripEmojiAndSymbols(text: string): string {
  // Removes emoji + pictographic/symbol ranges, keeping normal punctuation
  // and all scripts (Latin, Devanagari, Gujarati) so this doesn't accidentally
  // strip legitimate non-English question text.
  return text.replace(
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F0FF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu,
    ''
  );
}

/** Normalizes a question for cache-key and greeting comparisons: lowercased,
 * collapsed whitespace, trailing punctuation stripped. NOT used to alter what
 * gets sent to Gemini — only for matching/caching. */
export function normalizeQuestion(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ').replace(/[?.!,]+$/g, '');
}

/**
 * Fast, local, zero-cost checks that run BEFORE any Firestore or Gemini call.
 * Catches empty/too-short input, pure emoji/symbol spam, greetings, and
 * simple gibberish (low vowel ratio, long repeated-character runs) — the
 * cheap 80% of spam, so the expensive daily-limit transaction and Gemini
 * call never even get invoked for obvious junk.
 */
export function validateQuestionFormat(raw: string): ValidationResult {
  const text = raw.trim();
  if (!text) {
    return { valid: false, reason: 'Please type your question.' };
  }

  const withoutEmoji = stripEmojiAndSymbols(text).trim();
  if (withoutEmoji.length === 0) {
    return { valid: false, reason: 'That looks like just emojis — please describe your doubt in words.' };
  }

  if (withoutEmoji.length < MIN_CHARS) {
    return { valid: false, reason: `Please write at least ${MIN_CHARS} characters describing your doubt.` };
  }

  const words = withoutEmoji.split(/\s+/).filter(Boolean);
  if (words.length < MIN_WORDS) {
    return { valid: false, reason: `Please write at least ${MIN_WORDS} words describing your doubt.` };
  }

  const normalized = normalizeQuestion(withoutEmoji).replace(/[^a-z\s]/g, '').trim();

  // Only reject as a "greeting" if the message is SHORT and basically just
  // the greeting — "hi, can you explain why the sky is blue" should not be
  // rejected even though it starts with "hi".
  if (words.length <= 4 && GREETINGS.includes(normalized)) {
    return {
      valid: false,
      reason: 'That looks like a greeting rather than a question. Try something like "Why does ice float on water?"',
    };
  }

  // Gibberish heuristic: real words have a reasonable vowel ratio; keyboard
  // mashing ("asdkfjlaskdf") usually doesn't.
  const letters = normalized.replace(/\s/g, '');
  if (letters.length >= 6) {
    const vowelCount = (letters.match(/[aeiou]/g) || []).length;
    if (vowelCount / letters.length < 0.15) {
      return {
        valid: false,
        reason: "That doesn't look like a real question — please rephrase your doubt in full words.",
      };
    }
  }

  // 5+ repeats of the same character ("aaaaaaa", "hahahaha" partially caught
  // too since "hh" "aa" pairs repeat, though this specifically catches the
  // single-char-run case; word-level repetition is caught by the vowel check
  // and greeting list working together in practice).
  if (/(.)\1{4,}/.test(normalized)) {
    return {
      valid: false,
      reason: "That doesn't look like a real question — please rephrase your doubt in full words.",
    };
  }

  return { valid: true };
}
