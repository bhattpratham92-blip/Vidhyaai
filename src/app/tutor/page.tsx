'use client';

import { useState } from 'react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Navbar } from '@/components/layout/Navbar';
import { ChatInterface } from '@/components/tutor/ChatInterface';
import { SessionSidebar } from '@/components/tutor/SessionSidebar';
import type { TutorSession } from '@/lib/types';

function TutorWorkspace() {
  const [selectedSession, setSelectedSession] = useState<TutorSession | null>(null);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  return (
    <div className="aurora-grid flex h-[calc(100vh-56px)] bg-paper">
      <SessionSidebar
        selectedId={selectedSession?.id}
        onSelect={setSelectedSession}
        onNewChat={() => setSelectedSession(null)}
        mobileOpen={mobileHistoryOpen}
        onMobileClose={() => setMobileHistoryOpen(false)}
      />
      <div className="flex-1 overflow-hidden p-3 sm:p-5">
        {/* key forces a clean remount when switching sessions, resetting
            ChatInterface's local state instead of merging old + new */}
        <div className="h-full overflow-hidden rounded-[1.5rem] border border-white/60 bg-surface shadow-xl shadow-indigo-950/10 dark:border-white/10"><ChatInterface key={selectedSession?.id || 'new'} initialSession={selectedSession} onOpenHistory={() => setMobileHistoryOpen(true)} /></div>
      </div>
    </div>
  );
}

export default function TutorPage() {
  return (
    <AuthGuard>
      <Navbar />
      <TutorWorkspace />
    </AuthGuard>
  );
}
