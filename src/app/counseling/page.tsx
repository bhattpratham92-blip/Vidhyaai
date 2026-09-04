'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { Bot, CalendarDays, CheckCircle2, HeartHandshake, LoaderCircle, LockKeyhole, MapPin, MessageCircleHeart, Send, Sparkles, UserRound, Video, X } from 'lucide-react';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Navbar } from '@/components/layout/Navbar';
import { useAuth } from '@/lib/hooks/useAuth';
import { CrisisSafetyModal } from '@/components/safety/CrisisSafetyModal';
import { hasImmediateSafetyConcern } from '@/lib/safety/crisis';
import { auth, db } from '@/lib/firebase/client';
import type { CounselingBooking, CounselingFormat } from '@/lib/types';

const supportTopics = [
  'Stress & burnout',
  'Exam anxiety',
  'Low mood',
  'Relationships',
  'Something else',
];

type WellbeingMessage = { role: 'user' | 'assistant'; content: string };

const openingMessage: WellbeingMessage = {
  role: 'assistant',
  content: "Hi, I’m Vidya’s wellbeing companion. I’m here to listen without judgment. What has been feeling difficult lately?",
};

function CounselingContent() {
  const { profile } = useAuth();
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [format, setFormat] = useState<CounselingFormat>('online');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [concern, setConcern] = useState('Stress & burnout');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [bookings, setBookings] = useState<CounselingBooking[]>([]);
  const [messages, setMessages] = useState<WellbeingMessage[]>([openingMessage]);
  const [chatInput, setChatInput] = useState('');
  const [chatError, setChatError] = useState('');
  const [chatting, setChatting] = useState(false);
  const [showCrisisSupport, setShowCrisisSupport] = useState(false);
  const [wellbeingRemaining, setWellbeingRemaining] = useState<number | null>(null);
  const [wellbeingLimit, setWellbeingLimit] = useState(20);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!profile) return;
    getDocs(query(
      collection(db, 'counselingBookings'),
      where('studentId', '==', profile.uid),
    ))
      .then((result) => setBookings(
        result.docs
          .map((item) => ({ id: item.id, ...item.data() } as CounselingBooking))
          .sort((a, b) => b.createdAt - a.createdAt)
          .slice(0, 3),
      ))
      .catch((error) => console.error('[counseling] failed to load bookings:', error));
  }, [profile]);

  useEffect(() => {
    auth.currentUser?.getIdToken().then(async (token) => {
      const response = await fetch('/api/counseling/usage', { headers: { Authorization: `Bearer ${token}` } });
      if (response.ok) {
        const data = await response.json();
        setWellbeingRemaining(data.remaining);
        setWellbeingLimit(data.limit);
      }
    });
  }, []);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = chatInput.trim();
    if (!content || chatting || wellbeingRemaining === 0) return;
    if (hasImmediateSafetyConcern(content)) {
      setMessages((current) => [...current, { role: 'user', content }]);
      setChatInput('');
      setShowCrisisSupport(true);
      // The browser does not decide risk or choose recipients. It asks the
      // server to independently assess the message; sandbox mode never sends
      // a real alert while this safety architecture is being tested.
      void auth.currentUser?.getIdToken().then((token) => fetch('/api/guardian/safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: content }),
      })).catch(() => undefined);
      return;
    }

    const updatedMessages = [...messages, { role: 'user' as const, content }];
    setMessages(updatedMessages);
    setChatInput('');
    setChatError('');
    setChatting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/counseling/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ messages: updatedMessages.slice(-12) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to reply right now.');
      setMessages((current) => [...current, { role: 'assistant', content: data.message }]);
      if (typeof data.remaining === 'number') setWellbeingRemaining(data.remaining);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'Unable to reply right now.');
      if (error instanceof Error && error.message.includes('Daily wellbeing chat limit')) setWellbeingRemaining(0);
    } finally {
      setChatting(false);
      chatInputRef.current?.focus();
    }
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    if (!preferredDate || !preferredTime) {
      setFormError('Please choose a preferred date and time.');
      return;
    }

    setSubmitting(true);
    setFormError('');
    try {
      const booking = {
        studentId: profile.uid,
        schoolId: profile.schoolId,
        format,
        preferredDate,
        preferredTime,
        concern: notes.trim() ? `${concern}: ${notes.trim()}` : concern,
        status: 'requested' as const,
        createdAt: Date.now(),
      };
      const reference = await addDoc(collection(db, 'counselingBookings'), booking);
      setBookings([{ id: reference.id, ...booking }, ...bookings]);
      setIsBookingOpen(false);
      setPreferredDate('');
      setPreferredTime('');
      setNotes('');
    } catch (error) {
      console.error('[counseling] failed to create booking:', error);
      setFormError('We could not send your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="aurora-grid relative mx-auto max-w-6xl overflow-hidden px-5 py-7 sm:px-6 sm:py-10">
      <div aria-hidden="true" className="pointer-events-none absolute -left-20 top-36 h-56 w-56 rounded-full bg-pink-200/50 blur-3xl dark:bg-pink-500/10" /><div aria-hidden="true" className="pointer-events-none absolute -right-24 top-72 h-72 w-72 rounded-full bg-cyan-200/50 blur-3xl dark:bg-cyan-400/10" />
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-fuchsia-600 via-violet-600 to-cyan-500 px-6 py-8 text-white shadow-xl shadow-violet-300/30 sm:px-9">
        <div className="absolute -right-8 -top-10 h-44 w-44 rounded-full bg-white/15" /><div className="absolute bottom-0 left-1/2 h-24 w-24 rounded-full bg-amber-200/30" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-100"><MessageCircleHeart size={18} /> Student wellbeing</div>
            <h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">A private space to feel heard.</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100 sm:text-base">Talk through academic pressure, anxiety, relationships, or anything else with a qualified mental-health expert.</p>
          </div>
          <button onClick={() => setIsBookingOpen(true)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-indigo-700 shadow-sm transition hover:bg-indigo-50">
            <HeartHandshake size={18} /> Connect with an expert
          </button>
        </div>
      </section>

      <section className="glass-card relative mt-7 overflow-hidden rounded-[2rem] border-violet-200/80 dark:border-violet-500/20">
        <div className="border-b border-violet-100 bg-gradient-to-r from-violet-50 via-pink-50 to-cyan-50 px-5 py-4 dark:border-violet-500/20 dark:from-violet-500/10 dark:via-pink-500/10 dark:to-cyan-500/10 sm:px-6">
          <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><span className="rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 p-2 text-white shadow-md"><Bot size={20} /></span><div><h2 className="font-display text-xl font-semibold">Talk with Vidya</h2><p className="mt-0.5 text-sm text-ink/60">A supportive AI companion for reflection and coping ideas. It is not a therapist or emergency service.</p></div></div>{wellbeingRemaining !== null && <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${wellbeingRemaining <= 5 ? 'bg-amber-100 text-amber-800' : 'bg-white/80 text-violet-700 shadow-sm dark:bg-surface'}`}>{wellbeingRemaining}/{wellbeingLimit} today</span>}</div>
        </div>
        <div className="max-h-[420px] min-h-64 space-y-4 overflow-y-auto px-5 py-5 sm:px-6" aria-live="polite">
          {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${message.role === 'user' ? 'bg-cyan-100 text-cyan-800' : 'bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white'}`}>{message.role === 'user' ? <UserRound size={16} /> : <Bot size={16} />}</span><p className={`max-w-[82%] whitespace-pre-wrap rounded-[1.35rem] px-4 py-3 text-sm leading-6 shadow-sm ${message.role === 'user' ? 'bg-gradient-to-br from-cyan-500 to-indigo-600 text-white' : 'bg-violet-50 text-ink dark:bg-violet-500/10'}`}>{message.content}</p></div>)}
          {chatting && <div className="flex gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white"><Bot size={16} /></span><div className="rounded-2xl bg-violet-50 px-4 py-3 text-sm text-ink/60 dark:bg-violet-500/10"><LoaderCircle className="animate-spin" size={17} /></div></div>}
        </div>
        <form onSubmit={sendMessage} className="border-t border-violet-100 p-4 sm:p-5"><label className="sr-only" htmlFor="wellbeing-message">Your message</label>{wellbeingRemaining === 0 && <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">You&apos;ve reached today&apos;s 20-message wellbeing-chat limit. You can still book an expert session.</p>}<div className="flex items-end gap-3 rounded-[1.4rem] border border-violet-200 bg-violet-50/50 p-2 focus-within:border-violet-500 dark:border-violet-500/30 dark:bg-violet-500/10"><textarea ref={chatInputRef} id="wellbeing-message" value={chatInput} onChange={(event) => setChatInput(event.target.value)} rows={2} maxLength={1200} disabled={wellbeingRemaining === 0} placeholder={wellbeingRemaining === 0 ? 'Daily wellbeing limit reached' : 'Share what’s on your mind…'} className="min-h-12 flex-1 resize-none bg-transparent px-2 py-1 text-sm outline-none disabled:cursor-not-allowed" /><button disabled={!chatInput.trim() || chatting || wellbeingRemaining === 0} className="rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 p-3 text-white shadow-md hover:from-violet-700 hover:to-fuchsia-600 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send message"><Send size={18} /></button></div>{chatError && <p className="mt-2 text-sm text-red-600">{chatError}</p>}<p className="mt-2 text-xs text-ink/50">If you feel unsafe, stop chatting and contact emergency services or a trusted adult immediately.</p></form>
        <div className="flex flex-col gap-2 border-t border-ink/10 bg-paper px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between"><span className="text-ink/60">Want to speak with a real person instead?</span><button onClick={() => setIsBookingOpen(true)} className="font-semibold text-indigo hover:underline">Book an expert session</button></div>
      </section>

      <section className="mt-7 grid gap-5 md:grid-cols-3">
        <article className="glass-card rounded-2xl p-5"><LockKeyhole className="text-indigo" size={22} /><h2 className="mt-4 font-display text-lg font-semibold">Private & respectful</h2><p className="mt-2 text-sm leading-6 text-ink/60">Your request is shared only to arrange your support session.</p></article>
        <article className="glass-card rounded-2xl p-5"><Video className="text-indigo" size={22} /><h2 className="mt-4 font-display text-lg font-semibold">Meet your way</h2><p className="mt-2 text-sm leading-6 text-ink/60">Choose a secure online meeting or an in-person conversation.</p></article>
        <article className="glass-card rounded-2xl p-5"><Sparkles className="text-indigo" size={22} /><h2 className="mt-4 font-display text-lg font-semibold">Student-centred</h2><p className="mt-2 text-sm leading-6 text-ink/60">A supportive, judgment-free conversation built around you.</p></article>
      </section>

      <section className="mt-7 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
        <h2 className="font-semibold">Need urgent help?</h2>
        <p className="mt-1 text-sm leading-6">This service is not for emergencies. If you may hurt yourself or someone else, contact local emergency services now or reach a trusted adult, family member, or your school immediately.</p>
      </section>

      <section className="mt-8">
        <div className="flex items-center justify-between"><div><h2 className="font-display text-xl font-semibold">Your session requests</h2><p className="mt-1 text-sm text-ink/60">An expert will confirm your requested time.</p></div><button onClick={() => setIsBookingOpen(true)} className="text-sm font-semibold text-indigo hover:underline">Book a session</button></div>
        {bookings.length === 0 ? <div className="mt-4 rounded-2xl border border-dashed border-ink/20 bg-surface px-5 py-8 text-center text-sm text-ink/60">You have no session requests yet.</div> : <div className="mt-4 grid gap-3">{bookings.map((booking) => <article key={booking.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-ink/10 bg-surface p-5 sm:flex-row sm:items-center"><div><div className="flex items-center gap-2 font-semibold"><CalendarDays size={17} className="text-indigo" />{booking.preferredDate} · {booking.preferredTime}</div><p className="mt-1 text-sm text-ink/60">{booking.format === 'online' ? 'Online meeting' : 'In-person meeting'} · {booking.concern}</p></div><span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200"><CheckCircle2 size={14} /> Request sent</span></article>)}</div>}
      </section>

      {isBookingOpen && <div className="fixed inset-0 z-50 flex items-end bg-ink/40 p-0 sm:items-center sm:justify-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="booking-title"><div className="w-full max-w-lg rounded-t-3xl bg-surface p-6 shadow-2xl sm:rounded-3xl"><div className="flex items-start justify-between"><div><h2 id="booking-title" className="font-display text-2xl font-semibold">Book a session</h2><p className="mt-1 text-sm text-ink/60">Choose what feels most comfortable for you.</p></div><button onClick={() => setIsBookingOpen(false)} className="rounded-full p-2 text-ink/60 hover:bg-mist" aria-label="Close booking form"><X size={20} /></button></div><form onSubmit={submitBooking} className="mt-6 space-y-5"><fieldset><legend className="text-sm font-semibold">Meeting type</legend><div className="mt-2 grid grid-cols-2 gap-3"><button type="button" onClick={() => setFormat('online')} className={`rounded-xl border p-3 text-left text-sm font-semibold ${format === 'online' ? 'border-indigo bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200' : 'border-ink/15'}`}><Video size={18} className="mb-2" />Online</button><button type="button" onClick={() => setFormat('in_person')} className={`rounded-xl border p-3 text-left text-sm font-semibold ${format === 'in_person' ? 'border-indigo bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200' : 'border-ink/15'}`}><MapPin size={18} className="mb-2" />In person</button></div></fieldset><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Preferred date<input type="date" min={new Date().toISOString().slice(0, 10)} value={preferredDate} onChange={(event) => setPreferredDate(event.target.value)} className="mt-1.5 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 font-normal" /></label><label className="text-sm font-semibold">Preferred time<input type="time" value={preferredTime} onChange={(event) => setPreferredTime(event.target.value)} className="mt-1.5 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 font-normal" /></label></div><label className="block text-sm font-semibold">What would you like support with?<select value={concern} onChange={(event) => setConcern(event.target.value)} className="mt-1.5 w-full rounded-lg border border-ink/15 bg-paper px-3 py-2 font-normal">{supportTopics.map((topic) => <option key={topic}>{topic}</option>)}</select></label><label className="block text-sm font-semibold">Anything you want the expert to know? <span className="font-normal text-ink/50">(optional)</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} maxLength={500} className="mt-1.5 w-full resize-none rounded-lg border border-ink/15 bg-paper px-3 py-2 font-normal" placeholder="You can keep this brief." /></label>{formError && <p className="text-sm text-red-600">{formError}</p>}<button disabled={submitting} className="w-full rounded-full bg-indigo px-5 py-3 text-sm font-bold text-white hover:bg-indigo-600 disabled:opacity-60">{submitting ? 'Sending request…' : 'Send session request'}</button></form></div></div>}
      {showCrisisSupport && <CrisisSafetyModal contact={profile?.trustedContact} onClose={() => setShowCrisisSupport(false)} />}
    </main>
  );
}

export default function CounselingPage() {
  return <AuthGuard allowedRoles={['student']}><Navbar /><CounselingContent /></AuthGuard>;
}
