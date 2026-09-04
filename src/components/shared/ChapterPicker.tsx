'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import type { Board, SyllabusChapter } from '@/lib/types';

interface Props {
  board: Board;
  grade: number;
  subject: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * Drop-in replacement for a plain chapter <input>. Looks up seeded syllabus
 * data for this board/grade/subject; if found, renders a dropdown of real
 * chapter names (this is what "curriculum alignment" actually means in the
 * data model — see scripts/seedSyllabus.ts to add more subjects). If
 * nothing's been seeded for this combination, falls back to the same free
 * text input as before, so an unseeded subject never blocks the student.
 */
export function ChapterPicker({ board, grade, subject, value, onChange, className }: Props) {
  const { firebaseUser } = useAuth();
  const [chapters, setChapters] = useState<SyllabusChapter[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await firebaseUser?.getIdToken();
      if (!token) return;
      const params = new URLSearchParams({ board, grade: String(grade), subject });
      const res = await fetch(`/api/syllabus?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (cancelled) return;
      if (res.ok) {
        const data = await res.json();
        setChapters(data.chapters);
      } else {
        setChapters([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [firebaseUser, board, grade, subject]);

  const baseClass =
    className ||
    'min-w-0 flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-indigo';

  if (chapters === null) {
    // Still loading — render the text input so there's no layout jump/flash
    // between "loading" and "no data found" states.
    return (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Chapter name"
        className={baseClass}
      />
    );
  }

  if (chapters.length === 0) {
    return (
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Chapter name (not in curriculum list yet — type it)"
        className={baseClass}
      />
    );
  }

  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={baseClass}>
      <option value="" disabled>Select a chapter</option>
      {[...chapters].sort((a, b) => a.order - b.order).map((c) => (
        <option key={c.name} value={c.name}>{c.name}</option>
      ))}
    </select>
  );
}
