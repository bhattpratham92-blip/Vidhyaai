'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import { ProgressChart } from './ProgressChart';
import type { StudentAnalyticsSnapshot } from '@/lib/types';

interface Props {
  studentId: string;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl2 border border-ink/10 bg-surface p-4 text-center">
      <p className="font-display text-2xl font-semibold text-indigo">{value}</p>
      <p className="mt-1 text-xs text-ink/50">{label}</p>
    </div>
  );
}

export function WeeklyReport({ studentId }: Props) {
  const { firebaseUser } = useAuth();
  const [snapshots, setSnapshots] = useState<StudentAnalyticsSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [rank, setRank] = useState<{ rank: number; totalStudents: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'analyticsSnapshots'),
            where('studentId', '==', studentId),
            orderBy('weekOf', 'desc'),
            limit(6)
          )
        );
        // Reverse to chronological order (oldest -> newest) for a left-to-right trend line
        setSnapshots(snap.docs.map((d) => d.data() as StudentAnalyticsSnapshot).reverse());
      } catch (err) {
        console.error('[WeeklyReport] failed to load snapshots:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId]);

  useEffect(() => {
    (async () => {
      const token = await firebaseUser?.getIdToken();
      if (!token) return;
      try {
        const res = await fetch('/api/rank', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          setRank({ rank: data.rank, totalStudents: data.totalStudents });
        }
        // A non-ok response (e.g. "not enough class data yet") just means no
        // rank card shows — not an error worth surfacing here, since it's
        // expected for a new class with few quiz-takers so far.
      } catch (err) {
        console.error('[WeeklyReport] failed to load rank:', err);
      }
    })();
  }, [firebaseUser, studentId]);

  if (loading) {
    return <p className="text-sm text-ink/50">Loading report…</p>;
  }

  if (snapshots.length === 0) {
    return (
      <p className="text-sm text-ink/60">
        This fills in once a few practice quizzes have been taken and a
        weekly update has run.
      </p>
    );
  }

  const latest = snapshots[snapshots.length - 1];
  const trendData = snapshots.map((s) => ({
    week: new Date(s.weekOf).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    score: s.avgQuizScore,
  }));

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Doubts asked" value={latest.doubtsAsked} />
        <StatCard label="Quizzes done" value={latest.quizzesCompleted} />
        <StatCard label="Avg score" value={`${latest.avgQuizScore}%`} />
        {rank ? (
          <StatCard label={`Class rank (of ${rank.totalStudents})`} value={`#${rank.rank}`} />
        ) : (
          <StatCard label="Est. minutes" value={latest.timeSpentMinutes} />
        )}
      </div>

      {/* Trend line - only meaningful with 2+ weeks of data */}
      {snapshots.length > 1 && (
        <div className="rounded-xl2 border border-ink/10 bg-surface p-5">
          <p className="text-sm font-semibold text-ink/70">Quiz score trend</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDEEF5" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${v}%`, 'Avg score']} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#3730A9"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#3730A9' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Strong / weak subjects */}
      {(latest.strongSubjects.length > 0 || latest.weakSubjects.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {latest.strongSubjects.map((s) => (
            <span key={s} className="rounded-full bg-leaf-light px-3 py-1 text-xs font-medium text-leaf">
              Strong: {s}
            </span>
          ))}
          {latest.weakSubjects.map((s) => (
            <span key={s} className="rounded-full bg-saffron-light/60 px-3 py-1 text-xs font-medium text-saffron">
              Needs work: {s}
            </span>
          ))}
        </div>
      )}

      {/* Concept mastery */}
      <div className="rounded-xl2 border border-ink/10 bg-surface p-5">
        <p className="text-sm font-semibold text-ink/70">Where you stand, by topic</p>
        <div className="mt-2">
          <ProgressChart conceptMastery={latest.conceptMastery} />
        </div>
      </div>
    </div>
  );
}
