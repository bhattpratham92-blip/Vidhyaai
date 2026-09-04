'use client';

import { useState } from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/lib/hooks/useAuth';
import { QuizRunner } from '@/components/quiz/QuizRunner';
import type { Quiz } from '@/lib/types';

function PracticeContent() {
  const { firebaseUser, profile } = useAuth();
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('mixed');
  const [questionCount, setQuestionCount] = useState(8);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    setQuiz(null);
    try {
      const token = await firebaseUser?.getIdToken();
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subject: topic.trim(),
          chapter: topic.trim(),
          grade: profile?.grade || 0,
          board: profile?.board || 'OTHER_STATE_BOARD',
          difficulty,
          questionCount,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate quiz');
      setQuiz(data.quiz);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (quiz) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-8">
        <button onClick={() => setQuiz(null)} className="text-sm font-medium text-indigo hover:underline">
          ← Back
        </button>
        <h2 className="mt-3 font-display text-lg font-semibold">{quiz.title}</h2>
        <QuizRunner quiz={quiz} onRetake={() => setQuiz(null)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="font-display text-2xl font-semibold">Practice quiz</h1>
      <p className="mt-1 text-sm text-ink/60">
        Create a quiz from any college topic and get explanations that help you learn.
      </p>

      <section className="mt-6 rounded-xl2 border border-ink/10 bg-surface p-5">
        <h2 className="font-display text-lg font-semibold">Make your own quiz</h2>
        <form onSubmit={handleGenerate} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 text-sm font-medium">Topic
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. DBMS normalization, Python loops, Engineering maths" className="mt-1 block w-full rounded-lg border border-ink/15 px-3 py-2 font-normal outline-none focus:border-indigo" />
          </label>
          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
            className="rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-indigo"
          >
            <option value="mixed">Mixed difficulty</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
          <select
            value={questionCount}
            onChange={(e) => setQuestionCount(Number(e.target.value))}
            className="rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-indigo"
          >
            {[5, 8, 10, 15].map((n) => <option key={n} value={n}>{n} questions</option>)}
          </select>
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-indigo px-5 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-60"
          >
            {loading ? 'Generating…' : 'Generate quiz'}
          </button>
        </form>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </section>
    </div>
  );
}

export default function PracticePage() {
  return (
    <AuthGuard>
      <Navbar />
      <PracticeContent />
    </AuthGuard>
  );
}
