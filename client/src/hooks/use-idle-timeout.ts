import { useEffect, useRef, useCallback, useState } from "react";

const DEFAULT_TIMEOUT_SEC = 1800;
const BEEP_LAST_SEC = 10;
const THROTTLE_MS = 1000;

function getWarningAtSec(totalSec: number): number {
  if (totalSec > 300) return 120;
  return Math.floor(totalSec * 0.5);
}

export function useIdleTimeout(totalTimeoutSec: number = DEFAULT_TIMEOUT_SEC) {
  const safeTotalSec = Math.max(60, totalTimeoutSec);
  const [timeLeft, setTimeLeft] = useState(safeTotalSec);
  const [showWarning, setShowWarning] = useState(false);

  const lastActivityRef = useRef<number>(Date.now());
  const showWarningRef = useRef(false);
  const beepPlayedRef = useRef<Set<number>>(new Set());
  const warningBeepPlayedRef = useRef(false);
  const loggedOutRef = useRef(false);
  const totalRef = useRef(safeTotalSec);

  totalRef.current = safeTotalSec;

  const prevTotalRef = useRef(safeTotalSec);
  useEffect(() => {
    if (prevTotalRef.current !== safeTotalSec) {
      prevTotalRef.current = safeTotalSec;
      lastActivityRef.current = Date.now();
      beepPlayedRef.current.clear();
      warningBeepPlayedRef.current = false;
      showWarningRef.current = false;
      setShowWarning(false);
      loggedOutRef.current = false;
      setTimeLeft(safeTotalSec);
    }
  }, [safeTotalSec]);

  const playBeep = useCallback((freq = 800, duration = 0.2) => {
    if (!window.ARUTSOK_AUDIO_ENABLED) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.frequency.value = freq;
      oscillator.type = "sine";
      gainNode.gain.value = 0.15;
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + duration);
    } catch {}
  }, []);

  const resetActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastActivityRef.current < THROTTLE_MS) return;
    if (showWarningRef.current) return;
    lastActivityRef.current = now;
    beepPlayedRef.current.clear();
    warningBeepPlayedRef.current = false;
  }, []);

  const dismissWarning = useCallback(() => {
    showWarningRef.current = false;
    setShowWarning(false);
    lastActivityRef.current = Date.now();
    beepPlayedRef.current.clear();
    warningBeepPlayedRef.current = false;
    loggedOutRef.current = false;
    setTimeLeft(totalRef.current);
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (loggedOutRef.current) return;

      const elapsed = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      const remaining = Math.max(0, totalRef.current - elapsed);
      setTimeLeft(remaining);

      const warningThreshold = getWarningAtSec(totalRef.current);

      if (remaining <= warningThreshold && !showWarningRef.current) {
        showWarningRef.current = true;
        setShowWarning(true);
        if (!warningBeepPlayedRef.current) {
          warningBeepPlayedRef.current = true;
          playBeep(800, 0.3);
        }
      }

      if (remaining > warningThreshold && showWarningRef.current) {
        showWarningRef.current = false;
        setShowWarning(false);
      }

      if (remaining <= BEEP_LAST_SEC && remaining > 0) {
        const beepAt = [10, 7, 3];
        for (const t of beepAt) {
          if (remaining === t && !beepPlayedRef.current.has(t)) {
            beepPlayedRef.current.add(t);
            playBeep(1000, 0.25);
          }
        }
      }

      if (remaining <= 0) {
        loggedOutRef.current = true;
        clearInterval(intervalId);
        showWarningRef.current = false;
        setShowWarning(false);
        sessionStorage.setItem("idle_logout_message", "Boli ste odhlaseny z dovodu necinnosti");
        window.location.href = "/api/logout";
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [playBeep]);

  useEffect(() => {
    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    events.forEach(evt => document.addEventListener(evt, resetActivity, { passive: true }));
    return () => {
      events.forEach(evt => document.removeEventListener(evt, resetActivity));
    };
  }, [resetActivity]);

  const warningThreshold = getWarningAtSec(safeTotalSec);
  const isRed = timeLeft <= (warningThreshold + 10);

  return { timeLeft, showWarning, dismissWarning, isRed };
}
