import { useEffect, useRef } from "react";
import { useAuth } from "./use-auth";

const MODULE_MAP: Record<string, string> = {
  "/": "dashboard",
  "/companies": "spolocnosti",
  "/partners": "partneri",
  "/products": "produkty",
  "/commissions": "provizie",
  "/subjects": "subjekty",
  "/settings": "nastavenia",
  "/history": "historia",
  "/users": "pouzivatelia",
  "/permission-groups": "skupiny_pravomoci",
};

function getModuleFromPath(): string {
  const path = window.location.pathname;
  return MODULE_MAP[path] || path.replace(/^\//, "") || "unknown";
}

function getButtonLabel(el: HTMLElement): string | null {
  if (el.tagName !== "BUTTON" && !el.closest("button") && el.getAttribute("role") !== "button") {
    return null;
  }

  const btn = el.tagName === "BUTTON" ? el : el.closest("button");
  if (!btn) return null;

  const testId = btn.getAttribute("data-testid");
  if (testId) return testId;

  const text = btn.textContent?.trim();
  if (text && text.length < 60) return text;

  const ariaLabel = btn.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;

  const title = btn.getAttribute("title");
  if (title) return title;

  return "button";
}

export function useGlobalClickLogger() {
  const { user } = useAuth();
  const throttleRef = useRef<number>(0);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target) return;

      const label = getButtonLabel(target);
      if (!label) return;

      const now = Date.now();
      if (now - throttleRef.current < 500) return;
      throttleRef.current = now;

      const module = getModuleFromPath();

      fetch("/api/click-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          buttonLabel: label,
          module,
        }),
      }).catch(() => {});
    }

    document.addEventListener("click", handleClick, { capture: true, passive: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, [user]);
}
