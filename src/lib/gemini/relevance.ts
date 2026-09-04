import { getRelevanceModel } from './client';

// Toggle this off (ENABLE_RELEVANCE_CHECK=false in .env.local) if it ever
// proves too strict for real classroom use — false negatives here (blocking
// a genuine question) are worse for the product than false positives
// (letting one off-topic question through, which the main tutor's own
// system prompt already redirects gracefully anyway — see
// buildTutorSystemPrompt's "Boundaries" section).
const ENABLED = process.env.ENABLE_RELEVANCE_CHECK !== 'false';

export async function checkSubjectRelevance(params: {
  question: string;
  subject: string;
  chapter?: string;
  grade: number;
}): Promise<{ relevant: boolean }> {
  if (!ENABLED) return { relevant: true };

  const prompt = `A Class ${params.grade} student selected the subject "${params.subject}"${
    params.chapter ? ` and chapter "${params.chapter}"` : ''
  } on a study app, then typed this: "${params.question}"

Is this a genuine academic doubt that reasonably relates to this SUBJECT
(school curriculum generally — students often ask about earlier or adjacent
chapters too, not only the exact chapter selected)? Mark NOT_RELEVANT only
for clearly off-topic chit-chat, personal questions unrelated to schoolwork,
or attempts to get the AI to do something other than teach.

Respond with ONLY one word: RELEVANT or NOT_RELEVANT.`;

  try {
    const model = getRelevanceModel();
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().toUpperCase();
    // Fail open: if the classification is ambiguous or the call errors,
    // don't block a real student over an infrastructure hiccup.
    return { relevant: !text.includes('NOT_RELEVANT') };
  } catch {
    return { relevant: true };
  }
}
