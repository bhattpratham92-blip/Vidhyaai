'use client';

import { useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/lib/hooks/useAuth';
import { ChapterPicker } from '@/components/shared/ChapterPicker';
import { getSubjectsFor } from '@/lib/utils/subjects';
import { SimplePdf } from '@/lib/utils/pdf';
import type { ChapterNote, Language } from '@/lib/types';

function NotesContent() {
  const { firebaseUser, profile } = useAuth();
  const subjects = getSubjectsFor(profile?.grade, profile?.stream);
  const [subject, setSubject] = useState(subjects[0]);
  const [chapter, setChapter] = useState('');
  const [language, setLanguage] = useState<Language>('en');
  const [note, setNote] = useState<ChapterNote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!chapter.trim()) return;
    setLoading(true);
    setError('');
    setNote(null);
    try {
      const token = await firebaseUser?.getIdToken();
      const res = await fetch('/api/notes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subject,
          chapter,
          grade: profile?.grade || 10,
          board: profile?.board || 'CBSE',
          language,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate notes');
      setNote(data.note);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function handleDownloadText() {
    if (!note) return;
    const lines = [
      `${note.subject} — ${note.chapter}`,
      '',
      'SUMMARY',
      note.summary,
      '',
      'KEY POINTS',
      ...note.keyPoints.map((p, i) => `${i + 1}. ${p}`),
    ];
    if (note.formulas?.length) {
      lines.push('', 'FORMULAS', ...note.formulas.map((f) => `- ${f}`));
    }
    if (note.diagramsDescribed?.length) {
      lines.push('', 'DIAGRAMS', ...note.diagramsDescribed.map((d) => `- ${d}`));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.subject}-${note.chapter}-notes.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDownloadPdf() {
    if (!note) return;
    const pdf = new SimplePdf(`${note.subject} — ${note.chapter}`, `Class ${note.grade} · ${note.board}`);
    pdf.addHeading('Summary');
    pdf.addText(note.summary);
    pdf.addHeading('Key Points');
    note.keyPoints.forEach((p) => pdf.addBullet(p));
    if (note.formulas?.length) {
      pdf.addHeading('Formulas');
      note.formulas.forEach((f) => pdf.addBullet(f));
    }
    if (note.diagramsDescribed?.length) {
      pdf.addHeading('Diagrams to know');
      note.diagramsDescribed.forEach((d) => pdf.addBullet(d));
    }
    pdf.save(`${note.subject}-${note.chapter}-notes.pdf`);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="font-display text-2xl font-semibold">Chapter notes</h1>
      <p className="mt-1 text-sm text-ink/60">
        Get a summary, key points, and formulas for any chapter — generated
        for your board and grade.
      </p>

      <form onSubmit={handleGenerate} className="mt-6 flex flex-wrap items-end gap-3">
        <select
          value={subject}
          onChange={(e) => { setSubject(e.target.value); setChapter(''); }}
          className="rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-indigo"
        >
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <ChapterPicker
          board={profile?.board || 'CBSE'}
          grade={profile?.grade || 10}
          subject={subject}
          value={chapter}
          onChange={setChapter}
          className="min-w-0 flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-indigo"
        />
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          className="rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-indigo"
        >
          <option value="en">English</option>
          <option value="hi">हिन्दी</option>
          <option value="gu">ગુજરાતી</option>
        </select>
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-indigo px-5 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-60"
        >
          {loading ? 'Generating…' : 'Generate notes'}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {note && (
        <article className="mt-8 rounded-xl2 border border-ink/10 bg-surface p-6">
          <div className="flex items-start justify-between">
            <h2 className="font-display text-xl font-semibold">
              {note.subject} — {note.chapter}
            </h2>
            <div className="flex gap-2">
              <button
                onClick={handleDownloadPdf}
                className="flex items-center gap-1.5 rounded-full bg-indigo px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600"
              >
                <FileText size={14} /> Download PDF
              </button>
              <button
                onClick={handleDownloadText}
                className="flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-mist"
              >
                <Download size={14} /> .txt
              </button>
            </div>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-ink/80">{note.summary}</p>

          <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-ink/50">
            Key points
          </h3>
          <ul className="mt-2 space-y-2">
            {note.keyPoints.map((p, i) => (
              <li key={i} className="flex gap-2 text-sm leading-relaxed">
                <span className="text-indigo">•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>

          {!!note.formulas?.length && (
            <>
              <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-ink/50">
                Formulas
              </h3>
              <ul className="mt-2 space-y-1.5">
                {note.formulas.map((f, i) => (
                  <li key={i} className="rounded-lg bg-mist px-3 py-2 text-sm">{f}</li>
                ))}
              </ul>
            </>
          )}

          {!!note.diagramsDescribed?.length && (
            <>
              <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-ink/50">
                Diagrams to know
              </h3>
              <ul className="mt-2 space-y-2">
                {note.diagramsDescribed.map((d, i) => (
                  <li key={i} className="text-sm leading-relaxed text-ink/80">{d}</li>
                ))}
              </ul>
            </>
          )}
        </article>
      )}
    </div>
  );
}

export default function NotesPage() {
  return (
    <AuthGuard>
      <Navbar />
      <NotesContent />
    </AuthGuard>
  );
}
