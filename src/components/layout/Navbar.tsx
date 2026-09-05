'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { ThemeToggle } from './ThemeToggle';

export function Navbar() {
  const { profile, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = profile?.role === 'student'
    ? [
        { href: '/tutor', label: 'AI Tutor' },
        { href: '/practice', label: 'My Quizzes' },
        { href: '/leaderboard', label: 'Leaderboard' },
        { href: '/dashboard/student', label: 'Study Plan' },
        { href: '/counseling', label: 'Wellbeing' },
        { href: '/settings', label: 'Profile & settings' },
        { href: '/student/guardian', label: 'Guardian & privacy' },
      ]
    : profile?.role === 'guardian'
    ? [
        { href: '/guardian', label: 'Guardian dashboard' },
        { href: '/guardian', label: 'Emergency alerts' },
      ]
    : profile?.role === 'school_admin'
    ? [{ href: '/dashboard/admin', label: 'Admin dashboard' }]
    : [{ href: `/dashboard/${profile?.role}`, label: 'Dashboard' }];

  async function handleSignOut() {
    await signOut();
    router.push('/');
  }

  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-surface/95 px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/" className="font-display text-lg font-semibold">VidyaAI</Link>
        <nav className="hidden gap-5 text-sm font-medium lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={pathname === l.href ? 'text-indigo' : 'text-ink/60 hover:text-ink'}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-4 lg:flex">
        <ThemeToggle />
        <span className="text-sm text-ink/60">{profile?.name}</span>
        <button onClick={handleSignOut} className="text-sm font-medium text-ink/60 hover:text-ink">
          Sign out
        </button>
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="rounded-lg p-2 text-ink hover:bg-mist"
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>
      {menuOpen && <nav id="mobile-navigation" className="border-t border-ink/10 pt-3 lg:hidden">
        <p className="px-2 pb-2 text-xs font-semibold text-ink/55">Signed in as {profile?.name}</p>
        <div className="grid gap-1">
          {links.map((l, index) => (
            <Link key={`${l.href}-${index}`} href={l.href} onClick={() => setMenuOpen(false)} className={`rounded-lg px-3 py-2.5 text-sm font-medium ${pathname === l.href ? 'bg-indigo-50 text-indigo dark:bg-indigo-500/15' : 'text-ink/70 hover:bg-mist'}`}>
              {l.label}
            </Link>
          ))}
          <button onClick={handleSignOut} className="rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ink/70 hover:bg-mist">Sign out</button>
        </div>
      </nav>}
    </header>
  );
}
