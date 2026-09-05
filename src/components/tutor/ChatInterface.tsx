'use client';

import { useEffect, useRef, useState } from 'react';
import { BrainCircuit, Lightbulb, PanelLeft, Send, Sparkles } from 'lucide-react';
import { CrisisSafetyModal } from '@/components/safety/CrisisSafetyModal';
import { hasImmediateSafetyConcern } from '@/lib/safety/crisis';
import { useAuth } from '@/lib/hooks/useAuth';
import { validateQuestionFormat } from '@/lib/usage/validation';
import { LevelSelector } from './LevelSelector';
import { LanguageSelector } from './LanguageSelector';
import { ImageUpload } from './ImageUpload';
import { VoiceInput } from './VoiceInput';
import { SpeakButton } from './SpeakButton';
import type { ChatMessage, ExplainLevel, Language, TutorSession } from '@/lib/types';

const CLIENT_COOLDOWN_MS = 5000; // mirrors the server's real cooldown — this is just UI feedback, not enforcement

interface Props {
  // Pass a previously-loaded session to resume it. Render this component
  // with key={initialSession?.id || 'new'} from the parent so React remounts
  // (and resets local state) cleanly when the student switches sessions.
  initialSession?: TutorSession | null;
  onOpenHistory?: () => void;
}

export function ChatInterface({ initialSession, onOpenHistory }: Props) {
  const { firebaseUser, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(initialSession?.messages || []);
  const [sessionId, setSessionId] = useState<string | undefined>(initialSession?.id);
  const [input, setInput] = useState('');
  const [level, setLevel] = useState<ExplainLevel>('intermediate');
  const [language, setLanguage] = useState<Language>(profile?.preferredLanguage || 'en');
  const subject = initialSession?.subject || 'General study';
  const [sending, setSending] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ imageUrl: string; imageBase64: string; mimeType: string } | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [limit, setLimit] = useState(20);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [showCrisisSupport, setShowCrisisSupport] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Fetch today's usage on mount so the counter is accurate even before the
  // student sends anything (e.g. after switching sessions or reloading).
  useEffect(() => {
    (async () => {
      const token = await firebaseUser?.getIdToken();
      if (!token) return;
      const res = await fetch('/api/usage', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setRemaining(data.remaining);
        setLimit(data.limit);
      }
    })();
  }, [firebaseUser]);

  // Client-side cooldown countdown — purely cosmetic; the server enforces
  // the real 5-second gap regardless of what this shows.
  useEffect(() => {
    if (!cooldownUntil) return;
    const interval = setInterval(() => {
      const left = Math.max(0, cooldownUntil - Date.now());
      setCooldownLeft(left);
      if (left <= 0) clearInterval(interval);
    }, 200);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  async function authedFetch(url: string, body: unknown) {
    const token = await firebaseUser?.getIdToken();
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
  }

  function pushNotice(content: string) {
    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content,
        inputMode: 'text',
        explainLevel: level,
        language,
        subject,
        createdAt: Date.now(),
        isSystemNotice: true,
      },
    ]);
  }

  async function handleSendText() {
    const text = input;
    if (hasImmediateSafetyConcern(text)) {
      setInput('');
      setShowCrisisSupport(true);
      // Keep Tutor and Counselling consistent: only the server evaluates the
      // message and creates a sandbox Guardian event for an active connection.
      void firebaseUser?.getIdToken().then((token) => fetch('/api/guardian/safety', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text }),
      })).catch(() => undefined);
      return;
    }

    // Instant, zero-network-call rejection for obvious junk — same check
    // the server runs, imported directly since validation.ts has no
    // server-only dependencies. The server re-validates regardless; this is
    // purely so a student typing "hi" doesn't wait on a round-trip to be
    // told no.
    const format = validateQuestionFormat(text);
    if (!format.valid) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: text,
          inputMode: 'text',
          explainLevel: level,
          language,
          subject,
          createdAt: Date.now(),
        },
      ]);
      pushNotice(format.reason || 'Please rephrase your question.');
      setInput('');
      return;
    }

    setInput('');
    const optimisticUser: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      inputMode: 'text',
      explainLevel: level,
      language,
      subject,
      createdAt: Date.now(),
    };
    // Empty placeholder that fills in live as tokens stream in.
    const assistantId = crypto.randomUUID();
    const placeholder: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      inputMode: 'text',
      explainLevel: level,
      language,
      subject,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, optimisticUser, placeholder]);

    const res = await authedFetch('/api/tutor', {
      message: text,
      level,
      language,
      subject,
      grade: profile?.grade,
      board: profile?.board,
      sessionId,
    });

    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      const noticeText =
        data.error ||
        'Something went wrong — please try again.';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: noticeText, isSystemNotice: true } : m
        )
      );
      if (typeof data.remaining === 'number') setRemaining(data.remaining);
      if (data.code === 'immediate_safety_concern') setShowCrisisSupport(true);
      if (data.code === 'cooldown' && data.retryAfterMs) {
        setCooldownUntil(Date.now() + data.retryAfterMs);
      }
      return;
    }

    const newSessionId = res.headers.get('X-Session-Id');
    if (newSessionId) setSessionId(newSessionId);
    const remainingHeader = res.headers.get('X-Remaining-Questions');
    if (remainingHeader) setRemaining(Number(remainingHeader));

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      accumulated += decoder.decode(value, { stream: true });
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m))
      );
    }

    setCooldownUntil(Date.now() + CLIENT_COOLDOWN_MS);
  }

  async function handleSendImage() {
    if (!pendingImage) return;
    const optimisticUser: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input || '[Image doubt]',
      inputMode: 'image',
      imageUrl: pendingImage.imageUrl,
      explainLevel: level,
      language,
      subject,
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, optimisticUser]);
    setInput('');

    const res = await authedFetch('/api/tutor/image', {
      ...pendingImage,
      level,
      language,
      subject,
      grade: profile?.grade,
      board: profile?.board,
      sessionId,
    });
    const data = await res.json();
    if (res.ok) {
      setSessionId(data.sessionId);
      setMessages((prev) => [...prev, data.message]);
      if (typeof data.remaining === 'number') setRemaining(data.remaining);
      setCooldownUntil(Date.now() + CLIENT_COOLDOWN_MS);
    } else {
      pushNotice(data.error || 'Something went wrong — please try again.');
      if (typeof data.remaining === 'number') setRemaining(data.remaining);
      if (data.code === 'cooldown' && data.retryAfterMs) {
        setCooldownUntil(Date.now() + data.retryAfterMs);
      }
    }
    setPendingImage(null);
  }

  async function handleSend() {
    if (!input.trim() && !pendingImage) return;
    if (cooldownLeft > 0 || remaining === 0) return;
    setSending(true);
    if (pendingImage) {
      await handleSendImage();
    } else {
      await handleSendText();
    }
    setSending(false);
  }

  function chooseLearningStep(instruction: string) {
    setInput(instruction);
    inputRef.current?.focus();
  }

  const limitReached = remaining === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-100 bg-surface px-5 py-3.5 dark:border-indigo-400/15 sm:px-6">
        <div className="flex items-center gap-2 text-xs font-bold text-indigo-700 dark:text-indigo-200">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/15"><BrainCircuit size={15} /></span> Learn, don&apos;t copy
        </div>
        <LevelSelector value={level} onChange={setLevel} />
        <div className="flex items-center gap-3">
          {onOpenHistory && <button type="button" onClick={onOpenHistory} className="rounded-xl border border-indigo-200 bg-white p-2 text-indigo shadow-sm dark:border-indigo-400/20 dark:bg-surface sm:hidden" aria-label="Open previous chats"><PanelLeft size={18} /></button>}
          <LanguageSelector value={language} onChange={setLanguage} />
          {remaining !== null && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                limitReached ? 'bg-red-50 text-red-600' : remaining <= 5 ? 'bg-saffron-light/60 text-saffron' : 'bg-mist text-ink/60'
              }`}
            >
              Questions Left Today: {remaining}/{limit}
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
        {messages.length === 0 && (
          <div className="mx-auto max-w-md pt-16 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-xl shadow-indigo-500/25"><Sparkles size={27} /></span>
            <h2 className="mt-5 font-display text-3xl font-semibold text-ink">
              What are you stuck on today?
            </h2>
            <p className="mt-2 text-sm text-ink/60">
              Type a question, speak it out loud, or upload a photo of the
              problem — I&apos;ll walk you through it step by step.
            </p>
          </div>
        )}
        <div className="mx-auto max-w-2xl space-y-6">
          {messages.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={`max-w-[85%] rounded-xl2 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/15'
                    : m.isSystemNotice
                    ? 'border border-saffron-light bg-saffron-light/30 text-ink/80 italic'
                    : 'border border-indigo-100 bg-surface text-ink shadow-sm dark:border-indigo-400/15'
                }`}
              >
                {m.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.imageUrl} alt="Doubt" className="mb-2 max-h-40 rounded-lg" />
                )}
                {m.role === 'assistant' && m.content === '' ? (
                  <span className="flex gap-1 py-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/30 [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/30 [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/30 [animation-delay:300ms]" />
                  </span>
                ) : (
                  <>
                    {m.content}
                    {m.role === 'assistant' && !m.isSystemNotice && (
                      <SpeakButton text={m.content} language={m.language} />
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-indigo-100 bg-surface px-5 py-4 dark:border-indigo-400/15 sm:px-6">
        {limitReached && (
          <p className="mx-auto mb-2 max-w-2xl text-center text-sm font-medium text-red-600">
            Daily AI limit reached. Please try again tomorrow.
          </p>
        )}
        <div className="mx-auto mb-3 flex max-w-2xl flex-wrap gap-2">
          {[
            ['Give me a hint', 'Give me one small hint only. Do not reveal the full answer.'],
            ['Explain the concept', 'Explain the core concept first, then ask me one quick check question.'],
            ['Check my attempt', 'I want to share my attempt. Tell me what to try next without giving the full solution.'],
            ['Show next step', 'Show only the next step and explain why it matters.'],
            ['Show full solution', 'I have tried it. Please show the full solution and explain every important step.'],
          ].map(([label, instruction]) => (
            <button key={label} type="button" onClick={() => chooseLearningStep(instruction)} className="rounded-full border border-indigo-200 bg-indigo-50/50 px-3 py-1.5 text-xs font-bold text-indigo transition hover:-translate-y-0.5 hover:bg-indigo-100 dark:border-indigo-400/20 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20">
              {label}
            </button>
          ))}
        </div>
        <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-[1.4rem] border border-indigo-200 bg-paper/70 p-2 shadow-sm dark:border-indigo-400/20">
          {profile && <ImageUpload studentUid={profile.uid} onImageReady={setPendingImage} />}
          <VoiceInput language={language} onTranscript={(t) => setInput((prev) => (prev ? prev + ' ' + t : t))} />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !sending && handleSend()}
            disabled={limitReached}
            placeholder={
              limitReached
                ? 'Daily limit reached — come back tomorrow'
                : pendingImage
                ? 'Add a note about the image (optional)…'
                : 'Ask your doubt…'
            }
            className="flex-1 rounded-full bg-transparent px-3 py-2.5 text-sm outline-none disabled:bg-mist disabled:text-ink/40"
          />
          <button
            onClick={handleSend}
            disabled={sending || limitReached || cooldownLeft > 0 || (!input.trim() && !pendingImage)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25 transition hover:scale-105 disabled:opacity-40"
            aria-label="Send"
            title={cooldownLeft > 0 ? `Wait ${Math.ceil(cooldownLeft / 1000)}s` : undefined}
          >
            {cooldownLeft > 0 ? (
              <span className="text-xs font-semibold">{Math.ceil(cooldownLeft / 1000)}</span>
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </div>
      {showCrisisSupport && <CrisisSafetyModal contact={profile?.trustedContact} onClose={() => setShowCrisisSupport(false)} />}
    </div>
  );
}
