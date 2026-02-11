import { useEffect, useRef, useCallback } from "react";

const IDLE_TIMEOUT_MS = 180_000;
const THROTTLE_MS = 10_000;

export function useIdleTimeout() {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResetRef = useRef<number>(Date.now());

  const handleLogout = useCallback(() => {
    sessionStorage.setItem("idle_logout_message", "Boli ste odhlásený z dôvodu nečinnosti");
    window.location.href = "/api/logout";
  }, []);

  const resetTimer = useCallback(() => {
    const now = Date.now();
    if (now - lastResetRef.current < THROTTLE_MS) return;
    lastResetRef.current = now;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(handleLogout, IDLE_TIMEOUT_MS);
  }, [handleLogout]);

  useEffect(() => {
    timeoutRef.current = setTimeout(handleLogout, IDLE_TIMEOUT_MS);

    const events = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    events.forEach(evt => document.addEventListener(evt, resetTimer, { passive: true }));

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach(evt => document.removeEventListener(evt, resetTimer));
    };
  }, [resetTimer, handleLogout]);
}
