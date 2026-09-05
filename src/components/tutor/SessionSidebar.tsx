'use client';

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Plus, Sparkles, X } from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { db } from '@/lib/firebase/client';
import type { TutorSession } from '@/lib/types';

interface Props {
  selectedId?: string;
  onSelect: (session: TutorSession) => void;
  onNewChat: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function SessionSidebar({ selectedId, onSelect, onNewChat, mobileOpen = false, onMobileClose }: Props) {
  const { profile } = useAuth();
  const [sessions, setSessions] = useState<TutorSession[]>([]);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (!profile) {
      setSessions([]);
      return;
    }
    const q = query(
      collection(db, 'tutorSessions'),
      where('studentId', '==', profile.uid),
      orderBy('updatedAt', 'desc'),
      limit(20)
    );
    setLoadError('');
    // Live subscription — a newly created session appears here automatically
    // without the student needing to refresh the page.
    const unsubscribe = onSnapshot(q, (snap) => {
      setSessions(snap.docs.map((d) => d.data() as TutorSession));
    }, () => setLoadError('Your previous chats could not be loaded. Please refresh and try again.'));
    return unsubscribe;
  }, [profile]);

  return (
    <>
      {mobileOpen && <button aria-label="Close previous chats" onClick={onMobileClose} className="fixed inset-0 z-[60] bg-ink/45 sm:hidden" />}
      <aside className={`${mobileOpen ? 'fixed inset-y-0 left-0 z-[70] flex w-[min(20rem,calc(100vw-3rem))] shadow-2xl' : 'hidden'} shrink-0 flex-col border-r border-indigo-100 bg-surface/95 p-3 backdrop-blur dark:border-indigo-400/15 sm:static sm:z-auto sm:flex sm:w-72 sm:shadow-none`}>
      <div className="relative rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-4 text-white shadow-lg shadow-indigo-500/20">
        <button aria-label="Close previous chats" onClick={onMobileClose} className="absolute right-2 top-2 rounded-lg p-2 text-white/90 hover:bg-white/15 sm:hidden"><X size={17} /></button>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.13em] text-indigo-100"><Sparkles size={14} /> AI study space</p>
        <p className="mt-2 font-display text-lg font-semibold">Learn one step at a time.</p>
        <button
          onClick={() => { onNewChat(); onMobileClose?.(); }}
          className="mt-4 flex w-full items-center gap-2 rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
        >
          <Plus size={14} /> New chat
        </button>
      </div>
      <div className="mt-4 flex-1 overflow-y-auto px-1 pb-3">
        <p className="px-2 pb-2 text-xs font-bold uppercase tracking-[0.13em] text-ink/40">Previous chats</p>
        {loadError && <p className="mx-2 mb-2 rounded-lg bg-red-50 px-2 py-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-200">{loadError}</p>}
        {sessions.length === 0 && (
          <p className="px-2 py-4 text-xs text-ink/40">
            Your past doubt-solving sessions will show up here.
          </p>
        )}
        {sessions.map((s) => {
          const lastMessage = s.messages[s.messages.length - 1];
          return (
            <button
              key={s.id}
              onClick={() => { onSelect(s); onMobileClose?.(); }}
              className={`mb-1 w-full rounded-lg px-3 py-2 text-left ${
                selectedId === s.id ? 'bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo shadow-sm dark:from-indigo-500/15 dark:to-violet-500/15' : 'text-ink/70 hover:bg-mist'
              }`}
            >
              <p className="truncate text-sm font-medium">
                {s.subject}{s.chapter ? ` · ${s.chapter}` : ''}
              </p>
              <p className="truncate text-xs text-ink/40">
                {lastMessage ? lastMessage.content.slice(0, 42) : 'No messages yet'}
              </p>
              <p className="mt-1 text-[10px] text-ink/35">{new Date(s.updatedAt).toLocaleDateString()}</p>
            </button>
          );
        })}
      </div>
      </aside>
    </>
  );
}
