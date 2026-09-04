'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { sendEmailVerification } from 'firebase/auth';
import { useAuth } from '@/lib/hooks/useAuth';
import type { Role } from '@/lib/types';

export function AuthGuard({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: Role[];
}) {
  const { firebaseUser, profile, loading } = useAuth();
  const router = useRouter();
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationMessage, setVerificationMessage] = useState('');
  // Verification is secure by default. It can only be relaxed explicitly for
  // a local development environment by setting this variable to "false".
  const requireVerifiedUniversityEmail = process.env.NEXT_PUBLIC_REQUIRE_VERIFIED_UNIVERSITY_EMAIL !== 'false';

  async function refreshVerificationStatus() {
    if (!firebaseUser) return;
    setVerificationBusy(true);
    setVerificationMessage('');
    try {
      await firebaseUser.reload();
      if (firebaseUser.emailVerified) {
        window.location.reload();
        return;
      }
      setVerificationMessage('Your email is not verified yet. Open the link in your inbox, then try again.');
    } finally {
      setVerificationBusy(false);
    }
  }

  async function resendVerification() {
    if (!firebaseUser) return;
    setVerificationBusy(true);
    setVerificationMessage('');
    try {
      await sendEmailVerification(firebaseUser);
      setVerificationMessage('A new verification link has been sent. Check your inbox and spam folder.');
    } catch {
      setVerificationMessage('We could not send another link just yet. Please wait a moment and try again.');
    } finally {
      setVerificationBusy(false);
    }
  }

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.replace('/login');
      return;
    }
    if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
      router.replace('/dashboard/' + profile.role.replace('_admin', ''));
    }
  }, [loading, firebaseUser, profile, allowedRoles, router]);

  if (loading || !firebaseUser || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo border-t-transparent" />
      </div>
    );
  }

  if (requireVerifiedUniversityEmail && profile?.role !== 'guardian' && !firebaseUser.emailVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6">
        <div className="max-w-md rounded-2xl border border-indigo-400/20 bg-surface p-7 text-center shadow-soft">
          <h1 className="font-display text-2xl font-semibold">Verify your university email</h1>
          <p className="mt-3 text-sm leading-6 text-ink/70">We sent a verification link to <strong>{firebaseUser.email}</strong>. Open the link before you can access VidyaAI.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={refreshVerificationStatus} disabled={verificationBusy} className="rounded-xl bg-indigo px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">I verified my email</button>
            <button type="button" onClick={resendVerification} disabled={verificationBusy} className="rounded-xl border border-indigo/30 px-4 py-2.5 text-sm font-bold text-indigo disabled:opacity-60">Resend email</button>
          </div>
          {verificationMessage && <p className="mt-4 text-sm text-ink/70">{verificationMessage}</p>}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
