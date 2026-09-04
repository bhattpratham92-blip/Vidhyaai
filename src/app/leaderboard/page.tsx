'use client';

import { useEffect, useState } from 'react';
import { Crown, Medal, Trophy } from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/lib/hooks/useAuth';

type Leader = { rank: number; studentId: string; name: string; score: number; averageAccuracy: number; quizzesCompleted: number };

function LeaderboardContent() {
  const { firebaseUser, profile } = useAuth();
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    firebaseUser?.getIdToken().then(async (token) => {
      const response = await fetch('/api/leaderboard', { headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (response.ok) setLeaders(data.leaders);
      else setError(data.error || 'Could not load the leaderboard.');
    });
  }, [firebaseUser]);

  const myEntry = leaders.find((leader) => leader.studentId === profile?.uid);
  return <main className="mx-auto max-w-3xl px-6 py-8">
    <section className="rounded-3xl bg-gradient-to-br from-indigo-700 to-violet-500 px-7 py-8 text-white">
      <div className="flex items-center gap-3"><span className="rounded-full bg-white/15 p-2"><Trophy size={22} /></span><div><h1 className="font-display text-3xl font-semibold">Monthly leaderboard</h1><p className="mt-1 text-sm text-indigo-100">Top 3 eligible students each month earn a company gift.</p></div></div>
      <p className="mt-5 text-sm text-indigo-100">Rankings reward accuracy and consistent practice. Complete at least 3 quizzes to qualify.</p>
    </section>
    {myEntry && <div className="mt-5 rounded-2xl border border-indigo/20 bg-indigo-50 p-4 text-sm text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-100">Your current rank: <strong>#{myEntry.rank}</strong> · {myEntry.averageAccuracy}% average accuracy across {myEntry.quizzesCompleted} quizzes.</div>}
    {error ? <p className="mt-6 text-sm text-red-600">{error}</p> : leaders.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-ink/20 p-8 text-center text-sm text-ink/60">No eligible rankings yet. Complete 3 quizzes this month to enter the leaderboard.</div> : <ol className="mt-6 space-y-3">{leaders.map((leader) => <li key={leader.studentId} className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-surface p-4"><span className={`flex h-9 w-9 items-center justify-center rounded-full font-bold ${leader.rank === 1 ? 'bg-amber-100 text-amber-700' : leader.rank === 2 ? 'bg-slate-100 text-slate-700' : leader.rank === 3 ? 'bg-orange-100 text-orange-700' : 'bg-mist text-ink/60'}`}>{leader.rank <= 3 ? <>{leader.rank === 1 ? <Crown size={18} /> : <Medal size={18} />}</> : leader.rank}</span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{leader.name}{leader.studentId === profile?.uid ? ' (You)' : ''}</p><p className="mt-0.5 text-xs text-ink/55">{leader.quizzesCompleted} quizzes · {leader.averageAccuracy}% average accuracy</p></div><strong className="text-indigo">{leader.score} pts</strong></li>)}</ol>}
  </main>;
}

export default function LeaderboardPage() {
  return <AuthGuard allowedRoles={['student']}><Navbar /><LeaderboardContent /></AuthGuard>;
}
