'use client';

import { useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';

interface Props {
  onTranscript: (text: string) => void;
  language: 'en' | 'hi' | 'gu';
}

const LOCALE_MAP: Record<Props['language'], string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  gu: 'gu-IN',
};

// Uses the device's speech-recognition engine. Chrome/Edge provide the most
// dependable results; a good microphone and selecting the correct language
// are important because recognition is performed by the browser, not VidyaAI.
export function VoiceInput({ onTranscript, language }: Props) {
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const SpeechRecognitionCtor = typeof window !== 'undefined'
    ? window.SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition
    : undefined;

  if (!SpeechRecognitionCtor) return null;
  const Ctor = SpeechRecognitionCtor;

  function startListening() {
    const recognition = new Ctor();
    recognition.lang = LOCALE_MAP[language];
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;
    setStatus('Listening… speak clearly');

    recognition.onresult = (event) => {
      let finalText = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        if (event.results[index].isFinal) finalText += event.results[index][0].transcript;
      }
      if (finalText.trim()) {
        onTranscript(finalText.trim());
        setStatus('Added to your question');
      }
    };
    recognition.onerror = (event) => {
      const messages: Record<string, string> = {
        'not-allowed': 'Allow microphone access to use voice mode.',
        'no-speech': 'No speech heard. Try again a little closer to the mic.',
        'audio-capture': 'No microphone was found. Check your device settings.',
        network: 'Voice recognition needs an internet connection.',
      };
      setStatus(messages[event.error] || 'Voice recognition stopped. Please try again.');
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={listening ? stopListening : startListening}
        className={`flex h-10 w-10 items-center justify-center rounded-2xl border transition ${
          listening ? 'animate-pulse border-rose-400 bg-rose-50 text-rose-600 dark:bg-rose-500/15' : 'border-indigo-200 bg-surface text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 dark:border-indigo-400/20 dark:bg-indigo-500/10'
        }`}
        aria-label={listening ? 'Stop recording' : `Ask by voice in ${language === 'en' ? 'English' : language === 'hi' ? 'Hindi' : 'Gujarati'}`}
        title={`Voice input: ${LOCALE_MAP[language]}`}
      >
        {listening ? <Square size={16} /> : <Mic size={18} />}
      </button>
      {status && <span className="absolute bottom-full left-1/2 mb-2 w-52 -translate-x-1/2 rounded-lg bg-ink px-2 py-1.5 text-center text-[11px] leading-4 text-white shadow-lg">{status}</span>}
    </div>
  );
}
