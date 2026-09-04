import type { Metadata } from 'next';
import { Fraunces, Manrope } from 'next/font/google';
import { AuthProvider } from '@/lib/hooks/useAuth';
import './globals.css';

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '600', '700'],
});

const body = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'VidyaAI — Your 24/7 AI Teacher',
  description:
    'AI-powered learning platform for CBSE, ICSE, and State Board students — deep, step-by-step teaching in English, Hindi, and Gujarati.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Runs before hydration so there's no flash of the wrong theme —
            this is the standard pattern for class-based dark mode in
            Next.js, since React itself can't run early enough to prevent
            the flash on its own. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var saved = localStorage.getItem('theme');
                var isDark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (isDark) document.documentElement.classList.add('dark');
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={`${display.variable} ${body.variable} font-body bg-paper text-ink`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
