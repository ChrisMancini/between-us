"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SerializedActivity } from "@/lib/models/activity";

const POLL_INTERVAL = 30_000;

export function useActivityPoll() {
  const router = useRouter();
  const lastSeenRef = useRef<string | null>(null);
  const initializedRef = useRef(false);

  const poll = useCallback(async () => {
    if (document.visibilityState !== "visible") return;

    try {
      const params = new URLSearchParams({
        filter: "partner",
        limit: "5",
      });
      if (lastSeenRef.current) {
        params.set("cursor", new Date(Date.now()).toISOString());
      }

      const res = await fetch(`/api/activity?${params}`);
      if (!res.ok) return;

      const data: { activities: SerializedActivity[] } = await res.json();
      if (data.activities.length === 0) return;

      const latest = data.activities[0];

      if (!initializedRef.current) {
        lastSeenRef.current = latest.createdAt;
        initializedRef.current = true;
        return;
      }

      if (!lastSeenRef.current || latest.createdAt > lastSeenRef.current) {
        const newItems = data.activities.filter(
          (a) => !lastSeenRef.current || a.createdAt > lastSeenRef.current
        );

        if (newItems.length === 1) {
          toast.info(`${newItems[0].summary}`, {
            description: "Partner activity",
          });
        } else if (newItems.length > 1) {
          toast.info(`${newItems.length} new activities`, {
            description: "Partner activity",
            action: {
              label: "View",
              onClick: () => {
                window.location.href = "/activity";
              },
            },
          });
        }

        lastSeenRef.current = latest.createdAt;
        router.refresh();
      }
    } catch {
      // Silently ignore polling errors
    }
  }, [router]);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [poll]);
}
