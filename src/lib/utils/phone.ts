/**
 * Converts the formats commonly entered by Indian users into the E.164
 * representation Firebase and the Guardian API store and compare.
 */
export function normalizeGuardianPhone(value: unknown): string | null {
  const compact = String(value ?? '').trim().replace(/[\s()-]/g, '');
  const international = compact.startsWith('00') ? `+${compact.slice(2)}` : compact;

  // Guardian is currently tailored for India, so a bare 10-digit mobile
  // number is treated as an Indian number rather than rejected.
  const normalized = /^\d{10}$/.test(international)
    ? `+91${international}`
    : /^0\d{10}$/.test(international)
      ? `+91${international.slice(1)}`
      : international;

  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}
