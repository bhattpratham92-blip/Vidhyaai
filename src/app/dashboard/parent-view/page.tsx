'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Navbar } from '@/components/layout/Navbar';
import { WeeklyReport } from '@/components/dashboard/WeeklyReport';
import { useAuth } from '@/lib/hooks/useAuth';

// This is deliberately NOT a separate parent account — it's the exact same
// student login, just landed here instead of /tutor (see login/page.tsx's
// "I'm a parent" toggle). Nothing here can be edited; it's read-only by
// design, matching what a parent actually needs: visibility, not access to
// the tutor/notes/practice tools themselves.

function ParentViewContent() {
  const { firebaseUser, profile } = useAuth();
  const [digest, setDigest] = useState('');
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestError, setDigestError] = useState('');

  async function handleGetDigest() {
    if (!profile) return;
    setDigestLoading(true);
    setDigestError('');
    setDigest('');
    const token = await firebaseUser?.getIdToken();
    const res = await fetch('/api/parent/digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ childId: profile.uid }),
    });
    const data = await res.json();
    if (res.ok) {
      setDigest(data.digest);
    } else {
      setDigestError(data.error || 'Could not generate a digest right now.');
    }
    setDigestLoading(false);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">
          {profile?.name}&apos;s progress
        </h1>
        <Link href="/tutor" className="text-sm font-medium text-indigo hover:underline">
          Switch to student view
        </Link>
      </div>
      <p className="mt-1 text-sm text-ink/50">Read-only — parent view</p>

      <section className="mt-6 rounded-xl2 border border-ink/10 bg-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">This week&apos;s update</h2>
          <button
            onClick={handleGetDigest}
            disabled={digestLoading}
            className="rounded-full bg-indigo px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-60"
          >
            {digestLoading ? 'Generating…' : digest ? 'Refresh' : 'Get update'}
          </button>
        </div>

        {digestError && <p className="mt-3 text-sm text-red-600">{digestError}</p>}
        {digest && <p className="mt-4 text-sm leading-relaxed text-ink/80">{digest}</p>}
        {!digest && !digestError && !digestLoading && (
          <p className="mt-3 text-sm text-ink/60">
            Tap &quot;Get update&quot; for a plain-language summary of this week.
          </p>
        )}
      </section>

      <section className="mt-6">
        <h2 className="font-display text-lg font-semibold">Weekly report</h2>
        <div className="mt-3">
          {profile && <WeeklyReport studentId={profile.uid} />}
        </div>
      </section>
    </div>
  );
}

export default function ParentViewPage() {
  return (
    <AuthGuard allowedRoles={['student']}>
      <Navbar />
      <ParentViewContent />
    </AuthGuard>
  );
}
