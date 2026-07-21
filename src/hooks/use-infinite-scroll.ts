"use client";

import { useEffect, type RefObject } from "react";

export function useInfiniteScroll(
  sentinelRef: RefObject<HTMLElement | null>,
  onLoadMore: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !enabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onLoadMore();
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinelRef, onLoadMore, enabled]);
}
