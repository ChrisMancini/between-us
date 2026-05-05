"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MonthNavProps {
  month: number;
  year: number;
  basePath: string;
}

function monthLabel(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function MonthNav({ month, year, basePath }: MonthNavProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function go(delta: number) {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", String(m));
    params.set("year", String(y));
    router.push(`${basePath}?${params.toString()}`);
  }

  // Don't allow navigating into the future
  const now = new Date();
  const isCurrentOrFuture =
    year > now.getFullYear() ||
    (year === now.getFullYear() && month >= now.getMonth() + 1);

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
        onClick={() => go(-1)}
        aria-label="Previous month"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <span className="min-w-[160px] text-center text-sm font-semibold text-foreground">
        {monthLabel(month, year)}
      </span>

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
        onClick={() => go(1)}
        disabled={isCurrentOrFuture}
        aria-label="Next month"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
