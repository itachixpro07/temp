import { useCallback, useEffect, useRef, useState } from 'react';

// Native Web Speech API. No backend involvement, no external service.
const Recognition =
  typeof window !== 'undefined' &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

export const speechSupported = Boolean(Recognition);

// The backend stores languageUsed as a free-text lowercase string, so we pass
// through whatever locale the browser reports.
export const detectLocale = () =>
  (typeof navigator !== 'undefined' && navigator.language) || 'en-IN';

export function useSpeech({ lang } = {}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!Recognition) return undefined;

    const rec = new Recognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang || detectLocale();

    rec.onresult = (event) => {
      let text = '';
      for (let i = 0; i < event.results.length; i += 1) {
        text += event.results[i][0].transcript;
      }
      setTranscript(text);
    };
    rec.onerror = (event) => {
      setError(
        event.error === 'not-allowed'
          ? 'Microphone access is blocked. Allow it in your browser settings, or type instead.'
          : 'Could not hear that. Try again, or type instead.'
      );
      setListening(false);
    };
    rec.onend = () => setListening(false);

    ref.current = rec;
    return () => {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.stop();
      } catch {
        /* already stopped */
      }
    };
  }, [lang]);

  const start = useCallback(() => {
    if (!ref.current) return;
    setError(null);
    setTranscript('');
    try {
      ref.current.start();
      setListening(true);
    } catch {
      /* start() throws if already running */
    }
  }, []);

  const stop = useCallback(() => {
    try {
      ref.current?.stop();
    } catch {
      /* not running */
    }
    setListening(false);
  }, []);

  return { listening, transcript, error, start, stop, setTranscript, supported: speechSupported };
}
