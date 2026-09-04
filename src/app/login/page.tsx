'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { ArrowRight, BrainCircuit, LockKeyhole, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { auth, db } from '@/lib/firebase/client';
import type { UserProfile } from '@/lib/types';

export default function LoginPage() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);

      // Firebase caches this flag until the user object is reloaded. Always
      // reload here so a student who has just clicked their email link is
      // recognised immediately, and an unverified account cannot continue.
      await auth.currentUser?.reload();
      if (!auth.currentUser?.emailVerified) {
        router.push('/tutor'); // AuthGuard shows the mandatory verification screen.
        return;
      }

      const uid = auth.currentUser?.uid;
      const snap = uid ? await getDoc(doc(db, 'users', uid)) : null;
      const profile = snap?.exists() ? (snap.data() as UserProfile) : null;

      if (profile?.role === 'student') {
        router.push('/tutor');
      } else if (profile?.role) {
        router.push(profile.role === 'school_admin' ? '/dashboard/admin' : `/dashboard/${profile.role}`);
      } else {
        router.push('/tutor'); // profile doc genuinely missing — fall back rather than crash
      }
    } catch {
      setError('Could not sign in. Check your email and password and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordReset() {
    setError('');
    setResetMessage('');
    if (!email.trim()) {
      setError('Enter your university email first, then choose Forgot password.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetMessage('If this email has an account, we sent a password-reset link. Check your inbox and spam folder.');
    } catch {
      // Do not reveal whether an account exists for a particular email.
      setResetMessage('If this email has an account, we sent a password-reset link. Check your inbox and spam folder.');
    }
  }

  return (
    <main className="auth-shell aurora-grid flex min-h-screen items-center justify-center px-5 py-10">
      <div className="auth-card grid w-full max-w-5xl overflow-hidden rounded-[2rem] lg:grid-cols-[.9fr_1.1fr]">
        <aside className="auth-aside relative hidden overflow-hidden p-10 text-white lg:block">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full border-[32px] border-white/10" /><div className="absolute -bottom-16 -left-10 h-52 w-52 rounded-full bg-cyan-300/20 blur-2xl" />
          <Link href="/" className="relative flex items-center gap-2 font-display text-xl font-semibold"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">V</span>VidyaAI</Link>
          <div className="relative mt-24"><p className="flex items-center gap-2 text-sm font-bold text-cyan-100"><Sparkles size={16} /> YOUR LEARNING SPACE</p><h2 className="mt-4 font-display text-4xl font-semibold leading-tight">Welcome back to your momentum.</h2><p className="mt-5 max-w-xs text-sm leading-6 text-indigo-100">Pick up where you left off, ask your next question, and keep your semester moving.</p></div>
          <div className="relative mt-14 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur"><p className="text-xs font-bold uppercase tracking-wider text-cyan-100">Today&apos;s reminder</p><p className="mt-2 text-sm leading-6 text-slate-100">Small, consistent steps make hard subjects feel possible.</p></div>
        </aside>
        <div className="relative p-7 sm:p-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold lg:hidden"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs text-white">V</span>VidyaAI</Link>
          <ThemeToggle />
        </div>
        <span className="mt-9 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15"><BrainCircuit size={23} /></span>
        <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm leading-6 text-ink/70">Log in to continue learning, planning, and looking after your wellbeing.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-bold">University email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="aurora-input mt-1.5"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-bold">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="aurora-input mt-1.5"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {resetMessage && <p className="text-sm text-leaf">{resetMessage}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:shadow-indigo-500/35 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : <>Log in <ArrowRight size={17} /></>}
          </button>
          <button type="button" onClick={handlePasswordReset} className="flex w-full items-center justify-center gap-2 text-sm font-bold text-indigo hover:underline"><LockKeyhole size={14} /> Forgot password?</button>
        </form>

        <p className="mt-7 border-t border-ink/15 pt-6 text-center text-sm text-ink/70">
          New here?{' '}
          <Link href="/signup" className="font-medium text-indigo">Create an account</Link>
        </p>
        <p className="mt-3 text-center text-xs text-ink/55">Administrators can sign in here using their assigned email and password.</p>
        <p className="mt-3 text-center text-sm text-ink/70">Are you a trusted Guardian? <Link href="/guardian/login" className="font-bold text-indigo hover:underline">Guardian login</Link></p>
        </div>
      </div>
    </main>
  );
}
