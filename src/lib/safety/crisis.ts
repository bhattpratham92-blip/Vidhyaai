// A fast, conservative client/server safety signal. This does not diagnose a
// student; it only interrupts normal chat so urgent human support is visible.
// It covers direct self-harm and credible threats to another person, while the
// server prompt remains a second safety layer for unusual phrasing.
export const IMMEDIATE_SAFETY_PATTERN = /\b(kill myself|end my life|want to die|suicide|suicidal|hurt myself|harm myself|injure myself|self[- ]?harm|cut myself|cannot stay safe|drink poison|drank poison|take poison|took poison|poison myself|overdose|take pills to die|jump off|hang myself|(?:cut(?:t?ing)?|slice|slit|sever(?:ing)?) (?:my )?(?:nerve|vein|wrist|arm|skin|body)|bleeding (?:badly|a lot|heavily)|kill (him|her|them|someone|anyone|my friend|my family)|hurt (him|her|them|someone|anyone|my friend|my family)|harm (him|her|them|someone|anyone|my friend|my family)|stab (him|her|them|someone|anyone)|shoot (him|her|them|someone|anyone)|poison (him|her|them|someone|anyone)|attack (him|her|them|someone|anyone)|i (want|plan|am planning|will|am going|am gonna|might) to (kill|hurt|harm|stab|shoot|poison|attack)\b)/i;

export function hasImmediateSafetyConcern(text: string) {
  return IMMEDIATE_SAFETY_PATTERN.test(text);
}
