import Link from 'next/link';
import { ArrowRight, BrainCircuit, HeartHandshake, MessageSquareText, ShieldCheck, Sparkles, WandSparkles } from 'lucide-react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const features = [
  { icon: BrainCircuit, title: 'AI tutor, made for your course', text: 'Break down difficult concepts, prepare for exams, and learn at the depth that feels right.' },
  { icon: WandSparkles, title: 'Turn work into momentum', text: 'Create focused notes, practice questions, and a study plan from your own material.' },
  { icon: HeartHandshake, title: 'Wellbeing support that listens', text: 'A private, judgment-free space for stress, motivation, and academic pressure.' },
];

const steps = [
  ['Ask anything', 'Type, speak, or share a photo of a lecture slide, problem, or assignment.'],
  ['Learn your way', 'Choose the level and language that helps the idea click.'],
  ['Keep moving forward', 'Use focused practice and a practical plan for your next deadline.'],
];

export default function LandingPage() {
  return (
    <main className="aurora-grid min-h-screen overflow-hidden">
      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="group flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500 text-sm text-white shadow-lg shadow-indigo-500/25 transition group-hover:scale-105">V</span>
          VidyaAI
        </Link>
        <nav className="flex items-center gap-2 text-sm font-semibold sm:gap-4">
          <a href="#features" className="hidden rounded-full px-3 py-2 text-ink/65 transition hover:bg-surface hover:text-ink sm:inline">Explore</a>
          <ThemeToggle />
          <Link href="/login" className="rounded-full px-3 py-2 text-ink/70 transition hover:bg-surface hover:text-ink">Log in</Link>
          <Link href="/signup" className="rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-600 px-4 py-2.5 text-white shadow-lg shadow-indigo-500/30 transition hover:-translate-y-0.5 hover:from-indigo-500 hover:to-cyan-500 hover:shadow-xl hover:shadow-indigo-500/40">Get started</Link>
        </nav>
      </header>

      <section className="relative mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-12 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:pt-20">
        <div className="relative z-[1]">
          <p className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-surface/75 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-indigo-700 shadow-sm dark:border-indigo-400/20 dark:text-indigo-200"><Sparkles size={14} /> College learning, reimagined</p>
          <h1 className="mt-6 max-w-3xl font-display text-5xl font-semibold leading-[0.98] tracking-tight text-ink sm:text-6xl lg:text-7xl">A clearer mind.<br /><span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-cyan-500 bg-clip-text text-transparent">A stronger semester.</span></h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-ink/65 sm:text-lg">VidyaAI brings together a patient AI tutor, focused study tools, and supportive wellbeing guidance—so college feels more manageable, one step at a time.</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-indigo-500/30 transition hover:-translate-y-0.5 hover:shadow-indigo-500/40">Start learning free <ArrowRight size={17} /></Link>
            <a href="#how" className="rounded-full border border-indigo-200 bg-surface/70 px-6 py-3.5 text-sm font-bold text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-400/20 dark:text-indigo-200">See how it works</a>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-ink/65"><span className="inline-flex items-center gap-2"><ShieldCheck size={17} className="text-emerald-500" /> Private by design</span><span className="inline-flex items-center gap-2"><MessageSquareText size={17} className="text-cyan-500" /> Help when you need it</span></div>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
          <div aria-hidden="true" className="absolute -inset-8 rounded-full bg-gradient-to-tr from-indigo-500/25 via-violet-400/20 to-cyan-300/30 blur-3xl" />
          <div className="glass-card relative overflow-hidden rounded-[2rem] p-4 sm:p-6">
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-indigo-500/15 via-violet-400/10 to-cyan-400/15" />
            <div className="relative flex items-center justify-between"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25"><BrainCircuit size={20} /></span><div><p className="text-sm font-bold">Your study space</p><p className="text-xs text-ink/55">AI Tutor · ready when you are</p></div></div><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">Online</span></div>
            <div className="relative mt-7 space-y-4"><div className="rounded-2xl rounded-tl-sm bg-indigo-50 p-4 text-sm leading-6 text-indigo-950 dark:bg-indigo-500/15 dark:text-indigo-100"><p className="mb-1 text-xs font-bold uppercase tracking-wide text-indigo-500">You</p>Can you explain recursion with a simple example?</div><div className="rounded-2xl rounded-tr-sm border border-indigo-100 bg-surface p-4 text-sm leading-6 shadow-sm dark:border-indigo-400/15"><p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-violet-600"><Sparkles size={13} /> VidyaAI</p>Think of it like a set of nested boxes. We solve one small box, then use the same method for the next…</div></div>
            <div className="relative mt-5 flex gap-2 rounded-2xl border border-indigo-100 bg-paper/80 p-2 dark:border-indigo-400/15"><span className="flex-1 px-2 py-2 text-xs text-ink/40">Ask your next question…</span><span className="rounded-xl bg-indigo-600 p-2 text-white"><ArrowRight size={15} /></span></div>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-5 py-16 sm:px-8"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-sm font-bold uppercase tracking-[0.14em] text-indigo-600">Built for your real student life</p><h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Not just answers. Actual support.</h2></div><p className="max-w-md text-sm leading-6 text-ink/60">Move from confused to confident with tools that work together, not against you.</p></div><div className="mt-9 grid gap-5 md:grid-cols-3">{features.map(({ icon: Icon, title, text }, index) => <article key={title} className="glass-card group rounded-[1.75rem] p-6 transition duration-300 hover:-translate-y-1 hover:shadow-xl"><span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg ${index === 0 ? 'bg-gradient-to-br from-indigo-600 to-violet-600' : index === 1 ? 'bg-gradient-to-br from-cyan-500 to-blue-600' : 'bg-gradient-to-br from-rose-500 to-fuchsia-600'}`}><Icon size={23} /></span><h3 className="mt-6 font-display text-xl font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-ink/65">{text}</p></article>)}</div></section>

      <section id="how" className="mx-auto max-w-7xl px-5 py-16 sm:px-8"><div className="overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-10 text-white shadow-2xl shadow-indigo-950/30 dark:bg-slate-900 sm:px-10"><p className="text-sm font-bold uppercase tracking-[0.14em] text-cyan-300">Simple from the first click</p><h2 className="mt-3 max-w-lg font-display text-3xl font-semibold sm:text-4xl">Make space for the work—and for yourself.</h2><div className="mt-10 grid gap-7 md:grid-cols-3">{steps.map(([number, text], index) => <div key={number} className="border-t border-white/15 pt-5"><span className="text-sm font-bold text-cyan-300">0{index + 1}</span><h3 className="mt-3 text-lg font-bold text-white">{number}</h3><p className="mt-2 text-sm leading-6 text-indigo-100">{text}</p></div>)}</div><Link href="/signup" className="mt-10 inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-indigo-800 transition hover:bg-cyan-50">Create your account <ArrowRight size={16} /></Link></div></section>

      <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-10 text-sm text-ink/50 sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>© {new Date().getFullYear()} VidyaAI</span><span>Learn thoughtfully. Thrive fully.</span></footer>
    </main>
  );
}
