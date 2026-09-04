'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Square, Volume2 } from 'lucide-react';
import type { Language } from '@/lib/types';

const LOCALE_MAP: Record<Language, string> = { en: 'en-IN', hi: 'hi-IN', gu: 'gu-IN' };

// Prefer the best quality voice exposed by the student's device. Browsers
// label their neural voices differently, so quality terms are checked before
// the browser's generic/default voice. We never choose another language as a
// fallback: an English voice attempting Hindi/Gujarati is worse than silence.
function pickBestVoice(voices: SpeechSynthesisVoice[], locale: string) {
  const language = locale.split('-')[0].toLowerCase();
  const matching = voices.filter((voice) => voice.lang.toLowerCase() === locale.toLowerCase() || voice.lang.toLowerCase().startsWith(`${language}-`) || voice.lang.toLowerCase() === language);
  if (!matching.length) return undefined;
  const rank = (voice: SpeechSynthesisVoice) => {
    const name = voice.name.toLowerCase();
    if (/neural|natural|enhanced|premium|siri/.test(name)) return 0;
    if (/google|microsoft online/.test(name)) return 1;
    if (/microsoft|apple/.test(name)) return 2;
    return 3;
  };
  return [...matching].sort((a, b) => rank(a) - rank(b))[0];
}

function stripForSpeech(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, 'Code example omitted.')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/[>#*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function SpeakButton({ text, language }: { text: string; language: Language }) {
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [notice, setNotice] = useState('');
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!supported) return;
    const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  if (!supported || !text) return null;

  function toggleSpeak() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const locale = LOCALE_MAP[language];
    const voice = pickBestVoice(voices.length ? voices : window.speechSynthesis.getVoices(), locale);
    if (!voice) {
      setNotice(`No ${language === 'en' ? 'English (India)' : language === 'hi' ? 'Hindi' : 'Gujarati'} voice is installed on this device.`);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(stripForSpeech(text));
    utterance.lang = voice.lang;
    utterance.voice = voice;
    utterance.rate = language === 'en' ? 0.96 : 0.88;
    utterance.pitch = 1;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => {
      setSpeaking(false);
      setNotice('The voice could not play. Try selecting another browser or device voice.');
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setNotice('');
    setSpeaking(true);
  }

  return (
    <span className="relative mt-3 inline-flex flex-col items-start">
      <button onClick={toggleSpeak} className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-bold transition ${speaking ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200' : 'text-ink/45 hover:bg-indigo-50 hover:text-indigo dark:hover:bg-indigo-500/10'}`} aria-label={speaking ? 'Stop reading' : `Listen in ${localeName(language)}`}>
        {speaking ? <Square size={12} /> : <Volume2 size={14} />}{speaking ? 'Stop' : `Listen · ${localeName(language)}`}
      </button>
      {notice && <span className="absolute bottom-full left-0 mb-2 w-60 rounded-xl border border-amber-200 bg-amber-50 p-2 text-[11px] leading-4 text-amber-900 shadow-lg dark:border-amber-400/20 dark:bg-amber-500/15 dark:text-amber-100"><AlertCircle className="mr-1 inline" size={12} />{notice}</span>}
    </span>
  );
}

function localeName(language: Language) {
  return language === 'en' ? 'English' : language === 'hi' ? 'हिन्दी' : 'ગુજરાતી';
}
