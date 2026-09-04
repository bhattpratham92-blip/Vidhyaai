'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { ArrowRight, HeartHandshake, ShieldCheck, Sparkles } from 'lucide-react';

// Parent is deliberately NOT a signup role anymore — parents now log in
// using the SAME email/password as their child's account and choose
// "Parent view" on the login page, instead of creating a separate account.
// See src/app/login/page.tsx.
const UNIVERSITY_DOMAIN = process.env.NEXT_PUBLIC_UNIVERSITY_EMAIL_DOMAIN || 'gnu.ac.in';

function mapSignupError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  switch (code) {
    case 'auth/email-already-in-use':
      return 'That email is already registered — try logging in instead.';
    case 'auth/invalid-email':
      return 'That doesn\u2019t look like a valid email address.';
    case 'auth/weak-password':
      return 'Password is too weak — use at least 6 characters.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-up isn\u2019t enabled for this project yet — check Firebase Console \u2192 Authentication \u2192 Sign-in method.';
    case 'auth/network-request-failed':
      return 'Network error \u2014 check your internet connection and try again.';
    default:
      // Genuinely unknown error — show the raw message rather than a guess,
      // since a wrong guess (like always blaming "email in use") sends
      // people chasing the wrong fix.
      return (err as { message?: string })?.message || 'Could not create your account. Please try again.';
  }
}

export default function SignupPage() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    schoolId: 'ganpat-university',
    trustedContactName: '',
    trustedContactPhone: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.email.trim().toLowerCase().endsWith(`@${UNIVERSITY_DOMAIN}`)) {
      setError(`Use your official university email ending in @${UNIVERSITY_DOMAIN}.`);
      return;
    }
    if (!form.trustedContactName.trim() || !form.trustedContactPhone.trim()) {
      setError('Add a trusted contact name and phone number for urgent safety support.');
      return;
    }
    setLoading(true);
    try {
      await signUp({
        email: form.email,
        password: form.password,
        name: form.name,
        role: 'student',
        schoolId: form.schoolId,
        trustedContact: { name: form.trustedContactName.trim(), phone: form.trustedContactPhone.trim() },
      });
      router.push('/tutor');
    } catch (err) {
      setError(mapSignupError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell aurora-grid flex min-h-screen items-center justify-center px-5 py-10">
      <div className="auth-card grid w-full max-w-5xl overflow-hidden rounded-[2rem] lg:grid-cols-[.86fr_1.14fr]">
        <aside className="auth-aside relative hidden overflow-hidden p-10 text-white lg:block">
          <div className="absolute -right-24 top-10 h-64 w-64 rounded-full bg-violet-500/35 blur-3xl" /><div className="absolute -bottom-24 left-0 h-64 w-64 rounded-full bg-cyan-500/25 blur-3xl" />
          <Link href="/" className="relative flex items-center gap-2 font-display text-xl font-semibold"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">V</span>VidyaAI</Link>
          <div className="relative mt-20"><p className="flex items-center gap-2 text-sm font-bold text-cyan-300"><Sparkles size={16} /> START YOUR SPACE</p><h2 className="mt-4 font-display text-4xl font-semibold leading-tight">A better way to move through college.</h2><p className="mt-5 text-sm leading-6 text-indigo-100">One calm place for understanding your coursework and getting support when the pressure builds.</p></div>
          <ul className="relative mt-12 space-y-4 text-sm text-indigo-100"><li className="flex gap-3"><ShieldCheck className="shrink-0 text-cyan-300" size={19} /> Private learning and wellbeing support</li><li className="flex gap-3"><HeartHandshake className="shrink-0 text-rose-300" size={19} /> Built around you, never judgment</li></ul>
        </aside>
        <div className="p-7 sm:p-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold lg:hidden"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-xs text-white">V</span>VidyaAI</Link>
          <ThemeToggle />
        </div>
        <h1 className="mt-9 font-display text-3xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-2 text-sm leading-6 text-ink/70">Your personal learning and wellbeing space starts here.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="name" className="text-sm font-bold">Full name</label>
            <input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="aurora-input mt-1.5"
            />
          </div>

          <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-4 dark:border-violet-400/30 dark:from-violet-500/20 dark:to-indigo-500/20">
            <h2 className="flex items-center gap-2 text-sm font-bold"><HeartHandshake size={17} className="text-violet-600" /> Trusted safety contact</h2>
            <p className="mt-1 text-xs leading-5 text-ink/75">If you ever tell VidyaAI that you may harm yourself, the app will immediately show this person&apos;s call option. Choose someone you trust.</p>
            <label className="mt-3 block text-sm font-bold">Name<input required value={form.trustedContactName} onChange={(e) => setForm({ ...form, trustedContactName: e.target.value })} className="aurora-input mt-1.5 font-normal" /></label>
            <label className="mt-3 block text-sm font-bold">Phone number<input required type="tel" value={form.trustedContactPhone} onChange={(e) => setForm({ ...form, trustedContactPhone: e.target.value })} className="aurora-input mt-1.5 font-normal" /></label>
          </div>

          <div>
            <label htmlFor="email" className="text-sm font-bold">Official university email</label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="aurora-input mt-1.5"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-bold">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="aurora-input mt-1.5"
            />
            <p className="mt-1 text-xs text-ink/60">You will need to verify your email before using the production app.</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 font-bold text-white shadow-lg shadow-indigo-500/25 transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {loading ? 'Creating account…' : <>Create account <ArrowRight size={17} /></>}
          </button>
        </form>

        <p className="mt-7 border-t border-ink/15 pt-6 text-center text-sm text-ink/70">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-indigo">Log in</Link>
        </p>
        <p className="mt-3 text-center text-xs text-ink/55">Guardians use a separate phone-based <Link href="/guardian/login" className="font-bold text-indigo hover:underline">Guardian login</Link>.</p>
        </div>
      </div>
    </main>
  );
}
