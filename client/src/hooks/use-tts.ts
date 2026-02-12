import { useState, useCallback, useEffect, useRef } from "react";

const TTS_STORAGE_KEY = "arutsok_tts_enabled";

export function useTTS() {
  const [enabled, setEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem(TTS_STORAGE_KEY);
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });

  const spokenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      localStorage.setItem(TTS_STORAGE_KEY, String(enabled));
    } catch {}
  }, [enabled]);

  const speak = useCallback((text: string, key?: string) => {
    if (!enabled) return;
    if (key && spokenRef.current.has(key)) return;
    if (key) spokenRef.current.add(key);

    try {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "sk-SK";
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;

      const voices = window.speechSynthesis.getVoices();
      const skVoice = voices.find(v => v.lang.startsWith("sk"));
      if (skVoice) utterance.voice = skVoice;

      window.speechSynthesis.speak(utterance);
    } catch {}
  }, [enabled]);

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev;
      if (!next) {
        try { window.speechSynthesis?.cancel(); } catch {}
      }
      return next;
    });
  }, []);

  const resetSpoken = useCallback((key: string) => {
    spokenRef.current.delete(key);
  }, []);

  return { enabled, toggle, speak, resetSpoken };
}
