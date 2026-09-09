// A fast, conservative client/server safety signal. This does not diagnose a
// student; it only interrupts normal chat so urgent human support is visible.
// It covers direct self-harm and credible threats to another person, while the
// server prompt remains a second safety layer for unusual phrasing.
// This instant gate is intentionally narrow: it is only for an explicit
// self-harm intent, act, method, or inability to stay safe. Less-specific
// distress is handled by the server's private check-in layer, not an alert.
export const SELF_HARM_PATTERN = /\b(kill myself|end my life|want to die|hurt myself|harm myself|injure myself|cut myself|cannot stay safe|i(?:'m| am) suicidal|i (want|plan|am planning|will|am going|am gonna|might|think|am thinking) (?:to |about )?(kill|hurt|harm|injure|cut) myself|i (want|plan|am planning|will|am going|am gonna|might|think|am thinking) (?:to |about )?(?:self[- ]?harm|suicide)|(?:thinking|thoughts?) (?:about|of) (?:self[- ]?harm|suicide|killing myself)|drink poison|drank poison|take poison|took poison|poison myself|overdose|take pills to die|jump off|hang myself|i (want|plan|am planning|will|am going|am gonna|might|think|am thinking) to hang(?: myself)? (?:till|until) (?:the )?(?:last|end)(?: sec(?:ond)?s?)?|(?:cut(?:t?ing)?|slice|slit|sever(?:ing)?) (?:my )?(?:nerve|vein|wrist|arm|skin|body)|bleeding (?:badly|a lot|heavily))\b/i;

export const HARM_TO_OTHERS_PATTERN = /\b(kill (him|her|them|someone|anyone|everyone|my friend|my family|my dog|my cat|my pet|an animal)|hurt (him|her|them|someone|anyone|everyone|my friend|my family|my dog|my cat|my pet|an animal)|harm (him|her|them|someone|anyone|everyone|my friend|my family|my dog|my cat|my pet|an animal)|stab (him|her|them|someone|anyone|everyone|an animal)|shoot (him|her|them|someone|anyone|everyone|an animal)|poison (him|her|them|someone|anyone|everyone|an animal)|attack (him|her|them|someone|anyone|everyone|an animal)|i (want|plan|am planning|will|am going|am gonna|might|think|am thinking) to (kill|hurt|harm|stab|shoot|poison|attack))\b/i;

// Intent-first patterns catch the same risk expressed with different grammar
// or extra context, for example “after exams I might take my own life” or
// “I am thinking about hurting my dog.” They intentionally require a personal
// intent signal, so educational discussion or fiction alone does not alert a
// guardian.
const SELF_HARM_INTENT_PATTERN = /\b(?:i(?:'m| am)?\s+)?(?:want|need|plan|am planning|will|am going|am gonna|going|gonna|might|think|am thinking|thinking|thoughts?)\s+(?:to |about |of )?(?:self[- ]?harm|suicide|die|kill myself|take my (?:own )?life|end my life|end it|hurt myself|harm myself|injure myself|cut myself|hang myself|overdose)\b/i;
const HARM_LIVING_BEING_INTENT_PATTERN = /\b(?:i(?:'m| am)?\s+)?(?:want|need|plan|am planning|will|am going|am gonna|going|gonna|might|think|am thinking|thinking)\s+(?:to |about )?(?:kill|killing|hurt|hurting|harm|harming|injure|injuring|stab|stabbing|shoot|shooting|poison|poisoning|attack|attacking)(?:\s+(?:him|her|them|someone|anyone|everyone|a person|a human|my friend|my family|my dog|my cat|my pet|an animal|a living being))?\b/i;

export const IMMEDIATE_SAFETY_PATTERN = new RegExp(`${SELF_HARM_PATTERN.source}|${SELF_HARM_INTENT_PATTERN.source}|${HARM_TO_OTHERS_PATTERN.source}|${HARM_LIVING_BEING_INTENT_PATTERN.source}`, 'i');

// A single, ordinary feeling is not evidence of imminent danger. This guard
// prevents a probabilistic semantic classifier from turning messages such as
// “I am feeling sad” into an emergency alert. It deliberately matches only a
// complete, short statement; any added intent, plan, act, or threat continues
// through the full safety assessment below.
const ORDINARY_DISTRESS_ONLY_PATTERN = /^\s*(?:i(?:'m| am)?\s*)?(?:(?:am )?feeling|feel)?\s*(?:sad|stressed|anxious|worried|overwhelmed|lonely|tired|upset|down|depressed)(?:\s+(?:today|lately|right now))?[.!?]*\s*$/i;

export function hasImmediateSafetyConcern(text: string) {
  return IMMEDIATE_SAFETY_PATTERN.test(text);
}

export function hasHarmToOthersConcern(text: string) {
  return HARM_TO_OTHERS_PATTERN.test(text) || HARM_LIVING_BEING_INTENT_PATTERN.test(text);
}

export function isOrdinaryDistressOnly(text: string) {
  return !hasImmediateSafetyConcern(text) && ORDINARY_DISTRESS_ONLY_PATTERN.test(text);
}
