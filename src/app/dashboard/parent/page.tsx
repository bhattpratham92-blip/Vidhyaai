'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Navbar } from '@/components/layout/Navbar';
import { ProgressChart } from '@/components/dashboard/ProgressChart';
import { useAuth } from '@/lib/hooks/useAuth';
import { db } from '@/lib/firebase/client';
import type { StudentAnalyticsSnapshot, UserProfile } from '@/lib/types';

function ParentDashboardContent() {
  const { firebaseUser, profile } = useAuth();
  const [children, setChildren] = useState<UserProfile[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<StudentAnalyticsSnapshot | null>(null);
  const [digest, setDigest] = useState('');
  const [loading, setLoading] = useState(true);
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestError, setDigestError] = useState('');

  // --- Link-a-child form ---
  const [childEmail, setChildEmail] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState('');

  useEffect(() => {
    if (!profile) return;
    (async () => {
      if (!profile.childIds?.length) {
        setLoading(false);
        return;
      }
      const childrenQuery = query(
        collection(db, 'users'),
        where('uid', 'in', profile.childIds.slice(0, 10)) // Firestore 'in' caps at 10
      );
      const snap = await getDocs(childrenQuery);
      const kids = snap.docs.map((d) => d.data() as UserProfile);
      setChildren(kids);
      if (kids[0]) setSelectedChildId(kids[0].uid);
      setLoading(false);
    })();
  }, [profile]);

  async function handleLinkChild(e: React.FormEvent) {
    e.preventDefault();
    setLinking(true);
    setLinkError('');
    const token = await firebaseUser?.getIdToken();
    const res = await fetch('/api/family/link-child', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ childEmail }),
    });
    const data = await res.json();
    if (res.ok) {
      setChildren((prev) => [...prev, { uid: data.linkedChild.uid, name: data.linkedChild.name } as UserProfile]);
      setSelectedChildId(data.linkedChild.uid);
      setChildEmail('');
    } else {
      setLinkError(data.error || 'Could not link that account.');
    }
    setLinking(false);
  }

  async function handleGetDigest() {
    if (!selectedChildId) return;
    setDigestLoading(true);
    setDigestError('');
    setDigest('');
    const token = await firebaseUser?.getIdToken();
    const res = await fetch('/api/parent/digest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ childId: selectedChildId }),
    });
    const data = await res.json();
    if (res.ok) {
      setDigest(data.digest);
      setSnapshot(data.snapshot);
    } else {
      setDigestError(data.error || 'Could not generate a digest right now.');
    }
    setDigestLoading(false);
  }

  if (loading) return <div className="p-6 text-sm text-ink/50">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <h1 className="font-display text-2xl font-semibold">Your child&apos;s progress</h1>

      {children.length === 0 ? (
        <section className="mt-6 rounded-xl2 border border-ink/10 bg-surface p-6">
          <h2 className="font-display text-lg font-semibold">Link your child&apos;s account</h2>
          <p className="mt-1 text-sm text-ink/60">
            Enter the email your child used to sign up for VidyaAI at your school.
          </p>
          <form onSubmit={handleLinkChild} className="mt-4 flex gap-3">
            <input
              type="email"
              required
              value={childEmail}
              onChange={(e) => setChildEmail(e.target.value)}
              placeholder="child@example.com"
              className="flex-1 rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-indigo"
            />
            <button
              type="submit"
              disabled={linking}
              className="rounded-full bg-indigo px-5 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-60"
            >
              {linking ? 'Linking…' : 'Link account'}
            </button>
          </form>
          {linkError && <p className="mt-2 text-sm text-red-600">{linkError}</p>}
        </section>
      ) : (
        <>
          {children.length > 1 && (
            <div className="mt-6 flex gap-2">
              {children.map((c) => (
                <button
                  key={c.uid}
                  onClick={() => { setSelectedChildId(c.uid); setDigest(''); setSnapshot(null); }}
                  className={`rounded-full border px-4 py-1.5 text-sm ${
                    selectedChildId === c.uid ? 'border-indigo bg-indigo-50 text-indigo' : 'border-ink/15 text-ink/60'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}

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

          {snapshot && (
            <section className="mt-6 rounded-xl2 border border-ink/10 bg-surface p-6">
              <h2 className="font-display text-lg font-semibold">Where they stand, by topic</h2>
              <div className="mt-3">
                <ProgressChart conceptMastery={snapshot.conceptMastery} />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default function ParentDashboardPage() {
  return (
    <AuthGuard allowedRoles={['parent']}>
      <Navbar />
      <ParentDashboardContent />
    </AuthGuard>
  );
}
