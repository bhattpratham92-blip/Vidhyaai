'use client';

import type { ExplainLevel } from '@/lib/types';

const LEVELS: { value: ExplainLevel; label: string }[] = [
  { value: 'eli10', label: "Explain like I'm 10" },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

export function LevelSelector({
  value,
  onChange,
}: {
  value: ExplainLevel;
  onChange: (v: ExplainLevel) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {LEVELS.map((l) => (
        <button
          key={l.value}
          type="button"
          onClick={() => onChange(l.value)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            value === l.value
              ? 'border-indigo bg-indigo text-white'
              : 'border-ink/15 text-ink/60 hover:border-indigo/40'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
