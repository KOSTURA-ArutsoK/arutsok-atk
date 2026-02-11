import { useEffect, useRef, useCallback, useState } from "react";

const WARNING_TIMEOUT_MS = 120_000;
const LOGOUT_TIMEOUT_MS = 180_000;
const THROTTLE_MS = 10_000;

export function useIdleTimeout() {
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastResetRef = useRef<number>(Date.now());
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(60);

  const handleLogout = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    sessionStorage.setItem("idle_logout_message", "Boli ste odhlaseny z dovodu necinnosti");
    window.location.href = "/api/logout";
  }, []);

  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    warningTimerRef.current = null;
    logoutTimerRef.current = null;
    countdownRef.current = null;
  }, []);

  const showWarningPhase = useCallback(() => {
    setShowWarning(true);
    setSecondsLeft(60);

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.frequency.value = 800;
      oscillator.type = "sine";
      gainNode.gain.value = 0.15;
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch {}

    let count = 60;
    countdownRef.current = setInterval(() => {
      count--;
      setSecondsLeft(count);
      if (count <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
      }
    }, 1000);

    logoutTimerRef.current = setTimeout(handleLogout, LOGOUT_TIMEOUT_MS - WARNING_TIMEOUT_MS);
  }, [handleLogout]);

  const dismissWarning = useCallback(() => {
    setShowWarning(false);
    clearAllTimers();
    lastResetRef.current = Date.now();
    warningTimerRef.current = setTimeout(showWarningPhase, WARNING_TIMEOUT_MS);
  }, [clearAllTimers, showWarningPhase]);

  const resetTimer = useCallback(() => {
    if (showWarning) return;

    const now = Date.now();
    if (now - lastResetRef.current < THROTTLE_MS) return;
    lastResetRef.current = now;

    clearAllTimers();
    warningTimerRef.current = setTimeout(showWarningPhase, WARNING_TIMEOUT_MS);
  }, [showWarningPhase, clearAllTimers, showWarning]);

  useEffect(() => {
    warningTimerRef.current = setTimeout(showWarningPhase, WARNING_TIMEOUT_MS);

    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    events.forEach(evt => document.addEventListener(evt, resetTimer, { passive: true }));

    return () => {
      clearAllTimers();
      events.forEach(evt => document.removeEventListener(evt, resetTimer));
    };
  }, [resetTimer, showWarningPhase, clearAllTimers]);

  return { showWarning, secondsLeft, dismissWarning };
}
