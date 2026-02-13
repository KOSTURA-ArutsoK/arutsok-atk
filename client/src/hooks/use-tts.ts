import { useState, useCallback, useRef } from "react";

const TTS_STORAGE_KEY = "arutsok_tts_enabled";

declare global {
  interface Window {
    ARUTSOK_AUDIO_ENABLED: boolean;
  }
}

const storedValue = (() => {
  try {
    const stored = localStorage.getItem(TTS_STORAGE_KEY);
    return stored === null ? false : stored === "true";
  } catch {
    return false;
  }
})();

window.ARUTSOK_AUDIO_ENABLED = storedValue;

export function useTTS() {
  const [enabled, setEnabled] = useState(window.ARUTSOK_AUDIO_ENABLED);
  const spokenRef = useRef<Set<string>>(new Set());

  const speak = useCallback((text: string, key?: string) => {
    if (!window.ARUTSOK_AUDIO_ENABLED) return;
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
  }, []);

  const toggle = useCallback(() => {
    const next = !window.ARUTSOK_AUDIO_ENABLED;
    window.ARUTSOK_AUDIO_ENABLED = next;
    try { localStorage.setItem(TTS_STORAGE_KEY, String(next)); } catch {}
    if (!next) {
      try { window.speechSynthesis?.cancel(); } catch {}
    }
    setEnabled(next);
  }, []);

  const resetSpoken = useCallback((key: string) => {
    spokenRef.current.delete(key);
  }, []);

  return { enabled, toggle, speak, resetSpoken };
}
