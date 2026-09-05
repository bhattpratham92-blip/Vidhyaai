'use client';

import { FormEvent, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { Settings2, ShieldAlert, UserRound } from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/lib/hooks/useAuth';
import { auth, db } from '@/lib/firebase/client';

function SettingsContent() {
  const { profile, refreshProfile, signOut } = useAuth();
  const [gitaAddress, setGitaAddress] = useState<'sakha' | 'sakhi'>(profile?.gitaAddress || 'sakha');
  const [status, setStatus] = useState('');
  const [deleteText, setDeleteText] = useState('');
  const [busy, setBusy] = useState(false);

  async function saveGreeting(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setBusy(true); setStatus('');
    try { await updateDoc(doc(db, 'users', profile.uid), { gitaAddress }); await refreshProfile(); setStatus('Saved. Gita mode will now use this greeting.'); }
    catch { setStatus('We could not save that preference. Please try again.'); }
    finally { setBusy(false); }
  }

  async function deleteAccount() {
    if (deleteText !== 'DELETE MY ACCOUNT') return;
    setBusy(true); setStatus('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` }, body: JSON.stringify({ confirmation: deleteText }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to delete account.');
      // The server invalidates the account; this clears the local session too.
      await signOut();
      window.location.assign('/');
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Unable to delete account.'); setBusy(false); }
  }

  return <main className="mx-auto max-w-3xl px-5 py-8 sm:py-12"><div className="flex items-center gap-3"><span className="rounded-2xl bg-indigo-50 p-3 text-indigo dark:bg-indigo-500/15"><Settings2 size={24} /></span><div><h1 className="font-display text-3xl font-semibold">Profile & settings</h1><p className="mt-1 text-sm text-ink/60">Review your account and personalize Bhagavad Gita mode.</p></div></div>
    <section className="mt-8 rounded-3xl border border-ink/10 bg-surface p-6"><div className="flex items-center gap-3"><UserRound className="text-indigo" size={20} /><h2 className="font-display text-xl font-semibold">Your details</h2></div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-ink/55">Name</dt><dd className="mt-1 font-semibold">{profile?.name}</dd></div><div><dt className="text-ink/55">Email</dt><dd className="mt-1 break-all font-semibold">{profile?.email || auth.currentUser?.email}</dd></div><div><dt className="text-ink/55">Role</dt><dd className="mt-1 font-semibold capitalize">{profile?.role?.replace('_', ' ')}</dd></div><div><dt className="text-ink/55">University</dt><dd className="mt-1 font-semibold">{profile?.schoolId}</dd></div></dl></section>
    <section className="mt-5 rounded-3xl border border-amber-200 bg-amber-50/60 p-6 dark:border-amber-400/25 dark:bg-amber-500/10"><h2 className="font-display text-xl font-semibold">Bhagavad Gita mode</h2><p className="mt-1 text-sm text-ink/65">Choose the greeting Vidya uses for you. You can change this at any time.</p><form onSubmit={saveGreeting} className="mt-5"><div className="grid gap-3 sm:grid-cols-2"><label className={`cursor-pointer rounded-2xl border p-4 font-semibold ${gitaAddress === 'sakha' ? 'border-amber-500 bg-amber-100 text-amber-950 dark:bg-amber-400/15 dark:text-amber-100' : 'border-ink/15'}`}><input className="sr-only" type="radio" checked={gitaAddress === 'sakha'} onChange={() => setGitaAddress('sakha')} />Sakha</label><label className={`cursor-pointer rounded-2xl border p-4 font-semibold ${gitaAddress === 'sakhi' ? 'border-amber-500 bg-amber-100 text-amber-950 dark:bg-amber-400/15 dark:text-amber-100' : 'border-ink/15'}`}><input className="sr-only" type="radio" checked={gitaAddress === 'sakhi'} onChange={() => setGitaAddress('sakhi')} />Sakhi</label></div><button disabled={busy} className="mt-4 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-60">Save greeting</button></form></section>
    <section className="mt-5 rounded-3xl border border-red-200 bg-red-50 p-6 dark:border-red-500/30 dark:bg-red-500/10"><div className="flex gap-3"><ShieldAlert className="shrink-0 text-red-700" size={22} /><div><h2 className="font-display text-xl font-semibold text-red-900 dark:text-red-100">Delete account</h2><p className="mt-1 text-sm leading-6 text-red-900/80 dark:text-red-100/80">This permanently removes your sign-in and profile.</p></div></div><p className="mt-5 rounded-xl border border-red-200 bg-white/70 p-3 text-sm font-semibold text-red-900 dark:bg-surface dark:text-red-100">To delete your account, type exactly: <code>DELETE MY ACCOUNT</code></p><input aria-label="Delete account confirmation" value={deleteText} onChange={(event) => setDeleteText(event.target.value)} placeholder="Type DELETE MY ACCOUNT" className="mt-3 w-full rounded-xl border border-red-200 bg-white px-3 py-2.5 text-sm text-ink dark:bg-surface" /><button type="button" onClick={deleteAccount} disabled={busy || deleteText !== 'DELETE MY ACCOUNT'} className="mt-3 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">Delete my account</button></section>
    {status && <p className="mt-5 rounded-xl bg-mist p-3 text-sm text-ink/70">{status}</p>}
  </main>;
}

export default function SettingsPage() { return <AuthGuard><Navbar /><SettingsContent /></AuthGuard>; }
