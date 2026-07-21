"use client";

import { useEffect, useRef, type RefObject } from "react";

export function useInfiniteScroll(
  sentinelRef: RefObject<HTMLElement | null>,
  onLoadMore: () => void,
  enabled: boolean,
) {
  const callbackRef = useRef(onLoadMore);
  // Keep the ref current without writing to it during render (react-hooks/refs).
  useEffect(() => {
    callbackRef.current = onLoadMore;
  });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !enabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) callbackRef.current();
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinelRef, enabled]);
}
