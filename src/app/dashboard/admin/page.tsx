'use client';

import { useEffect, useState } from 'react';
import { CalendarCheck, CheckCircle2, Crown, GraduationCap, LoaderCircle, Trophy, UsersRound } from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/lib/hooks/useAuth';

type BookingStatus = 'requested' | 'confirmed' | 'completed' | 'cancelled';
type Booking = { id: string; studentName: string; format: string; preferredDate: string; preferredTime: string; concern: string; status: BookingStatus };
type Leader = { rank: number; studentId: string; name: string; score: number; averageAccuracy: number; quizzesCompleted: number };
type Overview = { students: number; counselingRequests: number; requestedSessions: number; completedSessions: number; quizAttempts: number; bookings: Booking[]; leaderboard: Leader[] };

function AdminOverview() {
  const { firebaseUser } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  async function loadOverview() {
    const token = await firebaseUser?.getIdToken();
    if (!token) return;
    const response = await fetch('/api/admin/overview', { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json();
    if (response.ok) setOverview(data);
    else setError(data.error || 'Could not load the admin overview.');
  }

  useEffect(() => { void loadOverview(); }, [firebaseUser]);

  async function updateBooking(bookingId: string, status: BookingStatus) {
    const token = await firebaseUser?.getIdToken();
    if (!token) return;
    setUpdating(bookingId);
    const response = await fetch('/api/admin/counseling', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ bookingId, status }) });
    if (response.ok) await loadOverview();
    else setError((await response.json()).error || 'Could not update this session.');
    setUpdating(null);
  }

  if (error) return <main className="mx-auto max-w-6xl px-6 py-8"><p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p></main>;
  if (!overview) return <main className="flex min-h-[50vh] items-center justify-center"><LoaderCircle className="animate-spin text-indigo" size={30} /></main>;

  const cards = [
    ['Students', overview.students, GraduationCap, 'All registered learners'],
    ['New session requests', overview.requestedSessions, CalendarCheck, 'Need your review'],
    ['Completed sessions', overview.completedSessions, CheckCircle2, 'Counselling support delivered'],
    ['This month’s quizzes', overview.quizAttempts, Trophy, 'Used for monthly winners'],
  ] as const;

  return <main className="aurora-grid min-h-[calc(100vh-56px)] px-5 py-7 sm:px-8">
    <div className="mx-auto max-w-6xl">
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-700 via-violet-700 to-cyan-600 px-6 py-8 text-white shadow-xl shadow-indigo-500/25 sm:px-9">
        <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full border-[28px] border-white/10" /><div className="relative"><p className="flex items-center gap-2 text-sm font-bold text-cyan-100"><UsersRound size={17} /> ADMIN OPERATIONS</p><h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">Manage your student community.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100">Review expert-session requests, track learning participation, and see the current monthly winner candidates.</p></div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map(([label, value, Icon, description]) => <article key={label} className="glass-card rounded-2xl p-5"><Icon className="text-indigo" size={22} /><p className="mt-4 text-3xl font-bold">{value}</p><p className="mt-1 text-sm font-bold">{label}</p><p className="mt-1 text-xs text-ink/55">{description}</p></article>)}</section>

      <section className="mt-7 grid gap-6 lg:grid-cols-[1.08fr_.92fr]">
        <div className="glass-card overflow-hidden rounded-[1.75rem]">
          <div className="flex items-start justify-between border-b border-indigo-100 px-5 py-5 dark:border-indigo-400/15"><div><h2 className="font-display text-xl font-semibold">Expert session requests</h2><p className="mt-1 text-sm text-ink/60">Confirm, complete, or cancel student counselling sessions.</p></div><span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-bold text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">{overview.counselingRequests} total</span></div>
          {overview.bookings.length === 0 ? <p className="p-8 text-center text-sm text-ink/55">No expert-session requests yet.</p> : <div className="divide-y divide-indigo-100 dark:divide-indigo-400/15">{overview.bookings.map((booking) => <article key={booking.id} className="p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-bold">{booking.studentName}</p><p className="mt-1 text-sm text-ink/60">{booking.preferredDate} · {booking.preferredTime} · {booking.format === 'online' ? 'Online' : 'In person'}</p><p className="mt-1 line-clamp-1 text-xs text-ink/50">{booking.concern}</p></div><select value={booking.status} disabled={updating === booking.id} onChange={(event) => void updateBooking(booking.id, event.target.value as BookingStatus)} className="rounded-xl border border-indigo-200 bg-surface px-3 py-2 text-xs font-bold text-indigo outline-none disabled:opacity-50 dark:border-indigo-400/20"><option value="requested">Requested</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div></article>)}</div>}
        </div>

        <div className="overflow-hidden rounded-[1.75rem] bg-slate-950 p-5 text-white shadow-xl shadow-indigo-950/20"><div className="flex items-start justify-between"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-amber-300"><Trophy size={15} /> Current month</p><h2 className="mt-2 font-display text-xl font-semibold">Projected winners</h2><p className="mt-1 text-sm leading-6 text-indigo-100/75">Top eligible students right now. Finalise after month-end.</p></div><Crown className="text-amber-300" size={27} /></div>{overview.leaderboard.length === 0 ? <p className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 text-sm leading-6 text-indigo-100/75">No eligible winners yet. Students need at least 3 quizzes this month to qualify.</p> : <ol className="mt-6 space-y-3">{overview.leaderboard.map((leader) => <li key={leader.studentId} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl font-bold ${leader.rank === 1 ? 'bg-amber-300 text-amber-950' : 'bg-white/10 text-white'}`}>#{leader.rank}</span><div className="min-w-0 flex-1"><p className="truncate font-bold">{leader.name}</p><p className="text-xs text-indigo-100/70">{leader.quizzesCompleted} quizzes · {leader.averageAccuracy}% average</p></div><strong className="text-sm text-amber-200">{leader.score}</strong></li>)}</ol>}<p className="mt-5 text-xs leading-5 text-indigo-100/60">Rankings reward accuracy and consistent practice. A student needs 3 completed quizzes to qualify.</p></div>
      </section>
    </div>
  </main>;
}

export default function AdminPage() { return <AuthGuard allowedRoles={['school_admin']}><Navbar /><AdminOverview /></AuthGuard>; }
