// A fast, conservative client/server safety signal. This does not diagnose a
// student; it only interrupts normal chat so urgent human support is visible.
// It covers direct self-harm and credible threats to another person, while the
// server prompt remains a second safety layer for unusual phrasing.
// This instant gate is intentionally narrow: it is only for an explicit
// self-harm intent, act, method, or inability to stay safe. Less-specific
// distress is handled by the server's private check-in layer, not an alert.
export const SELF_HARM_PATTERN = /\b(kill myself|end my life|want to die|hurt myself|harm myself|injure myself|cut myself|cannot stay safe|i(?:'m| am) suicidal|i (want|plan|am planning|will|am going|am gonna|might) to (kill|hurt|harm|injure|cut) myself|drink poison|drank poison|take poison|took poison|poison myself|overdose|take pills to die|jump off|hang myself|(?:cut(?:t?ing)?|slice|slit|sever(?:ing)?) (?:my )?(?:nerve|vein|wrist|arm|skin|body)|bleeding (?:badly|a lot|heavily))\b/i;

export const HARM_TO_OTHERS_PATTERN = /\b(kill (him|her|them|someone|anyone|my friend|my family)|hurt (him|her|them|someone|anyone|my friend|my family)|harm (him|her|them|someone|anyone|my friend|my family)|stab (him|her|them|someone|anyone)|shoot (him|her|them|someone|anyone)|poison (him|her|them|someone|anyone)|attack (him|her|them|someone|anyone)|i (want|plan|am planning|will|am going|am gonna|might) to (kill|hurt|harm|stab|shoot|poison|attack))\b/i;

export const IMMEDIATE_SAFETY_PATTERN = new RegExp(`${SELF_HARM_PATTERN.source}|${HARM_TO_OTHERS_PATTERN.source}`, 'i');

export function hasImmediateSafetyConcern(text: string) {
  return IMMEDIATE_SAFETY_PATTERN.test(text);
}

export function hasHarmToOthersConcern(text: string) {
  return HARM_TO_OTHERS_PATTERN.test(text);
}
