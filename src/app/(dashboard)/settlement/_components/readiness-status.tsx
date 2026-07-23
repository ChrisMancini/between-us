"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { PersonBadge } from "@/components/person-badge";
import { usePersons } from "@/components/persons-context";
import { badgeProps } from "@/lib/person-utils";
import type { PersonPair } from "@/lib/person-utils";

interface ReadinessStatusProps {
  month: number;
  year: number;
  doneBy: string[];
  persons: PersonPair;
  currentUserKey: string;
}

export function ReadinessStatus({
  month,
  year,
  doneBy: initialDoneBy,
  persons,
  currentUserKey,
}: ReadinessStatusProps) {
  const router = useRouter();
  const { personMap } = usePersons();
  const [doneBy, setDoneBy] = useState(initialDoneBy);
  const [loading, setLoading] = useState(false);

  const currentUserDone = doneBy.includes(currentUserKey);
  const bothDone = doneBy.length >= 2;

  async function handleToggle() {
    setLoading(true);
    const previousDoneBy = doneBy;

    if (currentUserDone) {
      setDoneBy(doneBy.filter((k) => k !== currentUserKey));
    } else {
      setDoneBy([...doneBy, currentUserKey]);
    }

    try {
      const res = await fetch("/api/settlement/ready", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year }),
      });

      if (!res.ok) {
        setDoneBy(previousDoneBy);
        const data = await res.json();
        toast.error(data.error ?? "Failed to update readiness");
        return;
      }

      const data: { doneBy: string[]; toggled: string } = await res.json();
      setDoneBy(data.doneBy);
      router.refresh();
    } catch {
      setDoneBy(previousDoneBy);
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const borderColor = bothDone
    ? "border-emerald-200 dark:border-emerald-800"
    : "border-primary/10";
  const bgColor = bothDone
    ? "bg-emerald-50/50 dark:bg-emerald-950/30"
    : "bg-card";

  return (
    <div
      className={`rounded-xl border ${borderColor} ${bgColor} shadow-sm overflow-hidden`}
    >
      <div
        className={`border-b px-5 py-3 ${
          bothDone
            ? "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50"
            : "border-primary/10 bg-primary/5"
        }`}
      >
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${
            bothDone
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-primary/70"
          }`}
        >
          {bothDone ? "Ready to Settle" : "Expense Entry Status"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {bothDone
            ? "Both people have finished entering expenses."
            : "Both people must mark as done before the month can be closed."}
        </p>
      </div>

      <div className="px-5 py-4 flex items-center gap-6">
        {persons.map((person) => {
          const isDone = doneBy.includes(person.key);
          const isCurrentUser = person.key === currentUserKey;

          return (
            <div key={person.key} className="flex items-center gap-2.5">
              {isCurrentUser ? (
                <button
                  onClick={handleToggle}
                  disabled={loading}
                  aria-busy={loading}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-muted/60 disabled:opacity-50 cursor-pointer"
                  title={isDone ? "Mark as not done" : "Mark as done"}
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
                  ) : isDone ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40" />
                  )}
                  <PersonBadge {...badgeProps(person.key, personMap)} />
                  <span className="text-sm text-muted-foreground">
                    {isDone ? "Done" : "Not done"}
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-2.5 px-3 py-2">
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40" />
                  )}
                  <PersonBadge {...badgeProps(person.key, personMap)} />
                  <span className="text-sm text-muted-foreground">
                    {isDone ? "Done" : "Not done"}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
