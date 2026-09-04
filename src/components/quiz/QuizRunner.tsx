'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, HelpCircle, FileText } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { SimplePdf } from '@/lib/utils/pdf';
import type { Quiz } from '@/lib/types';

interface GradedResult {
  questionId: string;
  studentAnswer: string;
  isCorrect: boolean | null;
  correctAnswer: string;
  explanation: string;
  concept: string;
}

export function QuizRunner({ quiz, onRetake }: { quiz: Quiz; onRetake: () => void }) {
  const { firebaseUser } = useAuth();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [startedAt] = useState(Date.now());
  const [results, setResults] = useState<GradedResult[] | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [ungradedCount, setUngradedCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    const token = await firebaseUser?.getIdToken();
    const res = await fetch('/api/quiz/attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ quizId: quiz.id, answers, startedAt }),
    });
    const data = await res.json();
    if (res.ok) {
      setResults(data.results);
      setScore(data.attempt.score);
      setUngradedCount(data.ungradedCount);
    }
    setSubmitting(false);
  }

  function handleDownloadPdf() {
    if (!results || score === null) return;
    const pdf = new SimplePdf(quiz.title, `${quiz.subject} · ${quiz.chapter} · Class ${quiz.grade}`);
    pdf.addText(`Score: ${score}%`, { size: 14, style: 'bold' });
    if (ungradedCount > 0) {
      pdf.addText(`${ungradedCount} written-answer question(s) are not auto-graded — check them against the explanation below.`, { size: 9, color: 130 });
    }
    quiz.questions.forEach((q, i) => {
      const r = results.find((res) => res.questionId === q.id)!;
      pdf.addHeading(`${i + 1}. ${q.question}`);
      const resultLabel = r.isCorrect === true ? 'Correct' : r.isCorrect === false ? 'Incorrect' : 'Self-check';
      pdf.addText(`Your answer: ${r.studentAnswer || '(no answer)'}  —  ${resultLabel}`, { size: 10 });
      if (r.isCorrect !== true) {
        pdf.addText(`Correct answer: ${r.correctAnswer}`, { size: 10 });
      }
      pdf.addText(r.explanation, { size: 10, color: 90 });
    });
    pdf.save(`${quiz.subject}-${quiz.chapter}-quiz-result.pdf`);
  }

  if (results) {
    return (
      <div className="mt-6">
        <div className="rounded-xl2 border border-ink/10 bg-surface p-6 text-center">
          <p className="text-sm text-ink/50">Auto-graded score</p>
          <p className="mt-1 font-display text-4xl font-semibold text-indigo">{score}%</p>
          {ungradedCount > 0 && (
            <p className="mt-2 text-xs text-ink/50">
              {ungradedCount} written-answer question{ungradedCount > 1 ? 's' : ''} below — check
              your own answer against the explanation.
            </p>
          )}
          <button
            onClick={handleDownloadPdf}
            className="mx-auto mt-4 flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-1.5 text-xs font-medium text-ink/70 hover:bg-mist"
          >
            <FileText size={14} /> Download result as PDF
          </button>
        </div>

        <div className="mt-6 space-y-4">
          {quiz.questions.map((q, i) => {
            const r = results.find((res) => res.questionId === q.id)!;
            return (
              <div key={q.id} className="rounded-xl2 border border-ink/10 bg-surface p-5">
                <div className="flex items-start gap-2">
                  {r.isCorrect === true && <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-leaf" />}
                  {r.isCorrect === false && <XCircle size={18} className="mt-0.5 shrink-0 text-red-500" />}
                  {r.isCorrect === null && <HelpCircle size={18} className="mt-0.5 shrink-0 text-saffron" />}
                  <p className="text-sm font-medium">{i + 1}. {q.question}</p>
                </div>
                <p className="mt-2 pl-6 text-sm text-ink/70">
                  Your answer: <span className="font-medium">{r.studentAnswer || '(no answer)'}</span>
                </p>
                {r.isCorrect !== true && (
                  <p className="mt-1 pl-6 text-sm text-ink/70">
                    {r.isCorrect === false ? 'Correct answer: ' : 'Model answer: '}
                    <span className="font-medium">{r.correctAnswer}</span>
                  </p>
                )}
                <p className="mt-2 pl-6 text-sm leading-relaxed text-ink/60">{r.explanation}</p>
              </div>
            );
          })}
        </div>

        <button
          onClick={onRetake}
          className="mt-6 rounded-full border border-ink/15 px-5 py-2 text-sm font-medium hover:bg-mist"
        >
          Generate a new quiz
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      {quiz.questions.map((q, i) => (
        <div key={q.id} className="rounded-xl2 border border-ink/10 bg-surface p-5">
          <p className="text-sm font-medium">{i + 1}. {q.question}</p>

          {q.type === 'mcq' && q.options && (
            <div className="mt-3 space-y-2">
              {q.options.map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={q.id}
                    value={opt}
                    checked={answers[q.id] === opt}
                    onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                  />
                  {opt}
                </label>
              ))}
            </div>
          )}

          {q.type === 'true_false' && (
            <div className="mt-3 flex gap-3">
              {['True', 'False'].map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name={q.id}
                    value={opt}
                    checked={answers[q.id] === opt}
                    onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                  />
                  {opt}
                </label>
              ))}
            </div>
          )}

          {(q.type === 'short_answer' || q.type === 'fill_blank') && (
            <input
              value={answers[q.id] || ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              className="mt-3 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-indigo"
              placeholder="Your answer"
            />
          )}

          {q.type === 'long_answer' && (
            <textarea
              value={answers[q.id] || ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              rows={4}
              className="mt-3 w-full rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-indigo"
              placeholder="Your answer"
            />
          )}
        </div>
      ))}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="rounded-full bg-indigo px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-60"
      >
        {submitting ? 'Grading…' : 'Submit quiz'}
      </button>
    </div>
  );
}
