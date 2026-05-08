"use client";

import { useActivityPoll } from "@/hooks/use-activity-poll";

export function ActivityPoller() {
  useActivityPoll();
  return null;
}
