'use client';

import type { Language } from '@/lib/types';

const LANGUAGES: { value: Language; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'gu', label: 'ગુજરાતી' },
];

export function LanguageSelector({
  value,
  onChange,
}: {
  value: Language;
  onChange: (v: Language) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as Language)}
      className="rounded-full border border-ink/15 bg-surface px-3 py-1.5 text-xs font-medium text-ink/70 outline-none focus:border-indigo"
      aria-label="Response language"
    >
      {LANGUAGES.map((l) => (
        <option key={l.value} value={l.value}>{l.label}</option>
      ))}
    </select>
  );
}
