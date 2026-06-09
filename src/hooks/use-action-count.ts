"use client";

import { useEffect, useState, useCallback } from "react";

const POLL_INTERVAL = 30_000;
const INVALIDATE_EVENT = "action-count-invalidate";

export function invalidateActionCount() {
  window.dispatchEvent(new Event(INVALIDATE_EVENT));
}

export function useActionCount() {
  const [count, setCount] = useState(0);

  const poll = useCallback(async () => {
    if (document.visibilityState !== "visible") return;

    try {
      const res = await fetch("/api/actions/count");
      if (!res.ok) return;
      const data: { count: number } = await res.json();
      setCount(data.count);
    } catch {
      // Silently ignore polling errors
    }
  }, []);

  useEffect(() => {
    const id = setInterval(poll, POLL_INTERVAL);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener(INVALIDATE_EVENT, poll);

    // Initial fetch — deferred so setState isn't synchronous in the effect body
    const timeout = setTimeout(poll, 0);

    return () => {
      clearTimeout(timeout);
      clearInterval(id);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener(INVALIDATE_EVENT, poll);
    };
  }, [poll]);

  return { count };
}
