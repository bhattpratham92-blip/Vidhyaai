'use client';

import { useRef, useState } from 'react';
import { ConfirmationResult, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { auth } from '@/lib/firebase/client';
import { normalizeGuardianPhone } from '@/lib/utils/phone';

function phoneAuthError(error: unknown) {
  const details = error as { code?: string; message?: string };
  const code = details?.code;
  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Phone verification is unavailable. In Firebase Console → Authentication → Settings → SMS region policy, allow India (+91). Also confirm Phone is enabled in Sign-in method.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized. In Firebase Console → Authentication → Settings → Authorized domains, add localhost (for local testing) or your live domain.';
    case 'auth/invalid-app-credential':
    case 'auth/captcha-check-failed':
      return 'Firebase could not validate the security check. Disable browser ad/content blockers, refresh the page, and confirm this domain is authorized in Firebase.';
    case 'auth/invalid-phone-number':
      return 'Use a valid international phone number, for example +919876543210.';
    case 'auth/too-many-requests':
      return 'Too many attempts were made. Wait before requesting another code, or use a Firebase test phone number during development.';
    case 'auth/quota-exceeded':
      return 'Firebase SMS quota has been reached. Use a Firebase test phone number while developing.';
    case 'auth/network-request-failed':
      return 'Firebase could not reach the verification service. Check your internet connection, then try again.';
    default:
      return `Firebase could not send the code${code ? ` (${code})` : ''}. ${details?.message || 'Check Phone sign-in, SMS region policy, and Authorized domains in Firebase Console.'}`;
  }
}

export default function GuardianLoginPage() {
  const verifier = useRef<RecaptchaVerifier | null>(null);
  const confirmation = useRef<ConfirmationResult | null>(null);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code' | 'profile'>('phone');
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    const normalizedPhone = normalizeGuardianPhone(phone);
    if (!normalizedPhone) { setError('Enter a valid mobile number, for example 9876543210 or +919876543210.'); return; }
    setBusy(true); setError('');
    try {
      if (!verifier.current) verifier.current = new RecaptchaVerifier(auth, 'guardian-recaptcha', { size: 'invisible' });
      confirmation.current = await signInWithPhoneNumber(auth, normalizedPhone, verifier.current);
      setPhone(normalizedPhone);
      setStep('code');
    } catch (error) { setError(phoneAuthError(error)); verifier.current?.clear(); verifier.current = null; }
    finally { setBusy(false); }
  }

  async function verifyCode() {
    if (!confirmation.current || !code.trim()) return;
    setBusy(true); setError('');
    try {
      await confirmation.current.confirm(code.trim());
      const token = await auth.currentUser?.getIdToken(true);
      const response = await fetch('/api/guardian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
        body: JSON.stringify({ action: 'profile-status' }),
      });
      const data = await response.json() as { registered?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || 'We could not check your Guardian profile.');
      if (data.registered) {
        window.location.assign('/guardian');
        return;
      }
      setStep('profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code is invalid or expired. Request a new code and try again.');
    }
    finally { setBusy(false); }
  }

  async function completeProfile() {
    if (!name.trim() || !relationship.trim()) { setError('Enter your name and relationship.'); return; }
    setBusy(true); setError('');
    try {
      const token = await auth.currentUser?.getIdToken(true);
      const response = await fetch('/api/guardian', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` }, body: JSON.stringify({ action: 'complete-profile', name, relationship }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.location.assign('/guardian');
    } catch (err) { setError(err instanceof Error ? err.message : 'We could not complete your profile.'); }
    finally { setBusy(false); }
  }

  return <main className="auth-shell aurora-grid flex min-h-screen items-center justify-center px-5 py-10"><section className="auth-card w-full max-w-md rounded-[2rem] p-8 sm:p-10"><Link href="/" className="flex items-center gap-2 font-display text-xl font-semibold"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo text-white"><ShieldCheck size={21} /></span>VidyaAI Guardian</Link><p className="mt-6 text-sm leading-6 text-ink/70">A separate, privacy-protected space for trusted emergency contacts. You cannot view a student&apos;s private conversations or study activity.</p>{step === 'phone' && <div className="mt-7 space-y-4"><label className="block text-sm font-bold">Mobile number<input value={phone} onChange={(event) => { setPhone(event.target.value); setError(''); }} placeholder="9876543210 or +919876543210" className="aurora-input mt-1.5" inputMode="tel" /></label><button onClick={sendCode} disabled={busy} className="w-full rounded-xl bg-indigo px-4 py-3 font-bold text-white disabled:opacity-60">{busy ? 'Sending…' : 'Send secure code'}</button></div>}{step === 'code' && <div className="mt-7 space-y-4"><label className="block text-sm font-bold">One-time verification code<input value={code} onChange={(event) => setCode(event.target.value)} className="aurora-input mt-1.5" inputMode="numeric" autoComplete="one-time-code" /></label><button onClick={verifyCode} disabled={busy} className="w-full rounded-xl bg-indigo px-4 py-3 font-bold text-white disabled:opacity-60">{busy ? 'Verifying…' : 'Verify code'}</button><button onClick={() => { setStep('phone'); setCode(''); setError(''); }} className="w-full text-sm font-bold text-indigo">Use a different number</button></div>}{step === 'profile' && <div className="mt-7 space-y-4"><label className="block text-sm font-bold">Your name<input value={name} onChange={(event) => setName(event.target.value)} className="aurora-input mt-1.5" /></label><label className="block text-sm font-bold">Relationship to the student<input value={relationship} onChange={(event) => setRelationship(event.target.value)} placeholder="Parent, aunt, mentor…" className="aurora-input mt-1.5" /></label><button onClick={completeProfile} disabled={busy} className="w-full rounded-xl bg-indigo px-4 py-3 font-bold text-white disabled:opacity-60">{busy ? 'Saving…' : 'Open Guardian dashboard'}</button></div>}{error && <p className="mt-4 text-sm text-red-600">{error}</p>}<div id="guardian-recaptcha" /></section></main>;
}
