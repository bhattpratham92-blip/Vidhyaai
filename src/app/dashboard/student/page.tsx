'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { CheckCircle2, Circle, CircleDot } from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Navbar } from '@/components/layout/Navbar';
import { WeeklyReport } from '@/components/dashboard/WeeklyReport';
import { useAuth } from '@/lib/hooks/useAuth';
import { db } from '@/lib/firebase/client';
import { startOfWeek } from '@/lib/utils/date';
import type { TutorSession, StudyPlan, StudyPlanItem, StudentAnalyticsSnapshot, StudyPreferences } from '@/lib/types';

const STATUS_ORDER: StudyPlanItem['status'][] = ['pending', 'in_progress', 'done'];
const STATUS_ICON = { pending: Circle, in_progress: CircleDot, done: CheckCircle2 };

function StudentDashboardContent() {
  const { firebaseUser, profile } = useAuth();
  const [recentSessions, setRecentSessions] = useState<TutorSession[]>([]);
  const [studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [snapshot, setSnapshot] = useState<StudentAnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [planError, setPlanError] = useState('');
  const [preferences, setPreferences] = useState<StudyPreferences>({ favoriteSubjects: '', difficultSubjects: '', recentMarks: '', studyHoursPerDay: 1, goal: '' });
  const [savingPreferences, setSavingPreferences] = useState(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      try {
        const sessionsQuery = query(
          collection(db, 'tutorSessions'),
          where('studentId', '==', profile.uid),
          orderBy('updatedAt', 'desc'),
          limit(5)
        );
        // A student's own studyPlan/analyticsSnapshot doc may not exist yet
        // (nothing generated for them so far) — that's an expected, normal
        // state, not an error, so each of these three loads independently
        // rather than one failure taking down the whole page.
        const [sessionsResult, planResult, snapshotResult] = await Promise.allSettled([
          getDocs(sessionsQuery),
          getDoc(doc(db, 'studyPlans', `${profile.uid}_${startOfWeek(Date.now())}`)),
          getDocs(
            query(
              collection(db, 'analyticsSnapshots'),
              where('studentId', '==', profile.uid),
              orderBy('weekOf', 'desc'),
              limit(1)
            )
          ),
        ]);

        if (sessionsResult.status === 'fulfilled') {
          setRecentSessions(sessionsResult.value.docs.map((d) => d.data() as TutorSession));
        }
        if (planResult.status === 'fulfilled' && planResult.value.exists()) {
          setStudyPlan(planResult.value.data() as StudyPlan);
        }
        if (snapshotResult.status === 'fulfilled' && !snapshotResult.value.empty) {
          setSnapshot(snapshotResult.value.docs[0].data() as StudentAnalyticsSnapshot);
        }
      } catch (err) {
        // Belt-and-suspenders: even if something above throws unexpectedly,
        // the page shows an error state instead of hanging on "Loading…"
        // forever with no way for the student to know something's wrong.
        console.error('[student dashboard] failed to load:', err);
        setLoadError('Could not load your progress right now. Try refreshing the page.');
      } finally {
        setLoading(false);
      }
    })();
  }, [profile]);

  useEffect(() => {
    if (profile?.studyPreferences) setPreferences(profile.studyPreferences);
  }, [profile]);

  async function savePreferences() {
    if (!profile) return;
    if (!preferences.difficultSubjects.trim()) {
      setPlanError('Add at least one subject you find difficult to create your plan.');
      return;
    }
    setSavingPreferences(true);
    setPlanError('');
    try {
      await updateDoc(doc(db, 'users', profile.uid), { studyPreferences: preferences });
      await handleGeneratePlan();
    } catch (error) {
      console.error('[study preferences] failed to save:', error);
      setPlanError('Could not save your preferences right now.');
    } finally {
      setSavingPreferences(false);
    }
  }

  async function handleGeneratePlan() {
    setGenerating(true);
    setPlanError('');
    const token = await firebaseUser?.getIdToken();
    const res = await fetch('/api/study-plan', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (res.ok) {
      setStudyPlan(data.plan);
    } else {
      setPlanError(data.error || 'Could not generate a study plan right now.');
    }
    setGenerating(false);
  }

  async function cycleStatus(item: StudyPlanItem) {
    if (!studyPlan) return;
    const nextStatus = STATUS_ORDER[(STATUS_ORDER.indexOf(item.status) + 1) % STATUS_ORDER.length];
    setStudyPlan({
      ...studyPlan,
      items: studyPlan.items.map((i) => (i.id === item.id ? { ...i, status: nextStatus } : i)),
    });
    const token = await firebaseUser?.getIdToken();
    await fetch('/api/study-plan/update-item', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ planId: studyPlan.id, itemId: item.id, status: nextStatus }),
    });
  }

  if (loading) {
    return <div className="p-6 text-sm text-ink/50">Loading your progress…</div>;
  }

  if (loadError) {
    return <div className="p-6 text-sm text-red-600">{loadError}</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="font-display text-2xl font-semibold">
        Welcome back, {profile?.name?.split(' ')[0]}
      </h1>

      {/* Weekly report */}
      <section className="mt-8">
        <h2 className="font-display text-lg font-semibold">Your weekly report</h2>
        <div className="mt-3">
          {profile && <WeeklyReport studentId={profile.uid} />}
        </div>
        {!snapshot && (
          <p className="mt-1 text-xs text-ink/50">
            (Take a few quizzes on the <a href="/practice" className="text-indigo underline">Practice</a> page to get this started.)
          </p>
        )}
      </section>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="rounded-xl2 border border-ink/10 bg-surface p-6">
          <h2 className="font-display text-lg font-semibold">Recent doubt-solving sessions</h2>
          {recentSessions.length === 0 ? (
            <p className="mt-3 text-sm text-ink/60">
              No sessions yet — head to the AI Tutor to ask your first doubt.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentSessions.map((s) => (
                <li key={s.id} className="flex justify-between text-sm">
                  <span>{s.subject}{s.chapter ? ` · ${s.chapter}` : ''}</span>
                  <span className="text-ink/50">{s.messages.length} messages</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl2 border border-ink/10 bg-surface p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">This week&apos;s study plan</h2>
            {studyPlan && (
              <button
                onClick={handleGeneratePlan}
                disabled={generating}
                className="text-xs font-medium text-indigo hover:underline disabled:opacity-50"
              >
                Regenerate
              </button>
            )}
          </div>

          {!studyPlan && (
            <div className="mt-3">
              <p className="text-sm text-ink/60">
                Complete a few practice quizzes on the{' '}
                <a href="/practice" className="text-indigo underline">Practice</a> page, then
                generate a plan built from your actual results.
              </p>
              <button
                onClick={handleGeneratePlan}
                disabled={generating}
                className="mt-3 rounded-full bg-indigo px-4 py-2 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-60"
              >
                {generating ? 'Generating…' : 'Generate my study plan'}
              </button>
              {planError && <p className="mt-2 text-xs text-red-600">{planError}</p>}
            </div>
          )}

          {studyPlan && (
            <ul className="mt-3 space-y-2.5">
              {studyPlan.items.map((item) => {
                const Icon = STATUS_ICON[item.status];
                return (
                  <li key={item.id} className="flex items-start gap-2.5 text-sm">
                    <button
                      onClick={() => cycleStatus(item)}
                      className={`mt-0.5 shrink-0 ${item.status === 'done' ? 'text-leaf' : 'text-ink/40'}`}
                      aria-label={`Mark as ${STATUS_ORDER[(STATUS_ORDER.indexOf(item.status) + 1) % 3]}`}
                    >
                      <Icon size={16} />
                    </button>
                    <div className={item.status === 'done' ? 'text-ink/40 line-through' : ''}>
                      <p className="font-medium">{item.subject} — {item.concept}</p>
                      <p className="text-xs text-ink/50">{item.reason}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-xl2 border border-ink/10 bg-surface p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-lg font-semibold">Make your study plan personal</h2><p className="mt-1 text-sm text-ink/60">Tell Vidya what you enjoy, where you struggle, and how much time you have.</p></div>{studyPlan && <button onClick={() => handleGeneratePlan()} disabled={generating} className="text-sm font-semibold text-indigo hover:underline disabled:opacity-50">Refresh this week&apos;s plan</button>}</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Subjects you enjoy<input value={preferences.favoriteSubjects} onChange={(e) => setPreferences({ ...preferences, favoriteSubjects: e.target.value })} placeholder="e.g. Programming, maths" className="mt-1 block w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 font-normal" /></label>
          <label className="text-sm font-medium">Subjects you find difficult *<input value={preferences.difficultSubjects} onChange={(e) => setPreferences({ ...preferences, difficultSubjects: e.target.value })} placeholder="e.g. DBMS, statistics" className="mt-1 block w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 font-normal" /></label>
          <label className="text-sm font-medium">Recent marks / CGPA<input value={preferences.recentMarks} onChange={(e) => setPreferences({ ...preferences, recentMarks: e.target.value })} placeholder="e.g. DBMS 58%, CGPA 7.2" className="mt-1 block w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 font-normal" /></label>
          <label className="text-sm font-medium">Daily study time<select value={preferences.studyHoursPerDay} onChange={(e) => setPreferences({ ...preferences, studyHoursPerDay: Number(e.target.value) })} className="mt-1 block w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 font-normal">{[1, 2, 3, 4, 5].map((hours) => <option key={hours} value={hours}>{hours} hour{hours > 1 ? 's' : ''}</option>)}</select></label>
          <label className="sm:col-span-2 text-sm font-medium">Your goal<input value={preferences.goal} onChange={(e) => setPreferences({ ...preferences, goal: e.target.value })} placeholder="e.g. Improve semester marks and prepare for placements" className="mt-1 block w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 font-normal" /></label>
        </div>
        <button onClick={savePreferences} disabled={savingPreferences || generating} className="mt-5 rounded-full bg-indigo px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60">{savingPreferences || generating ? 'Creating your plan…' : studyPlan ? 'Save preferences & refresh plan' : 'Create my weekly plan'}</button>
      </section>
    </div>
  );
}

export default function StudentDashboardPage() {
  return (
    <AuthGuard allowedRoles={['student']}>
      <Navbar />
      <StudentDashboardContent />
    </AuthGuard>
  );
}
