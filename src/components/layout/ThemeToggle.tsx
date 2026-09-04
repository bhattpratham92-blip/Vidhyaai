'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  // Starts false and syncs in useEffect (not read from localStorage
  // directly in useState) to avoid a server/client render mismatch — the
  // layout's inline bootstrap script already applied the right class before
  // this component even mounts, so this is purely for the icon to match.
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex h-8 w-8 items-center justify-center rounded-full text-ink/50 hover:bg-mist hover:text-ink"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
