"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export const FOCUS_EXPENSE_FORM_EVENT = "focus-expense-form";
export const OPEN_QUICK_ENTRY_EVENT = "open-quick-entry";

const CHORD_TIMEOUT_MS = 1500;

const CHORD_ROUTES: Record<string, string> = {
  d: "/dashboard",
  e: "/expenses",
  r: "/reports",
  s: "/settlement",
  a: "/activity",
  t: "/recurring",
};

function isInputElement(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

export function useHotkeys() {
  const router = useRouter();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const gPendingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearChord = useCallback(() => {
    gPendingRef.current = false;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (isInputElement(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      if (gPendingRef.current) {
        clearChord();
        const route = CHORD_ROUTES[key];
        if (route) {
          e.preventDefault();
          router.push(route);
        }
        return;
      }

      if (key === "g") {
        gPendingRef.current = true;
        timerRef.current = setTimeout(clearChord, CHORD_TIMEOUT_MS);
        return;
      }

      if (key === "?") {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }

      if (key === "n") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(OPEN_QUICK_ENTRY_EVENT));
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearChord();
    };
  }, [router, clearChord]);

  return { shortcutsOpen, setShortcutsOpen };
}
