"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface YearNavProps {
  year: number;
}

export function YearNav({ year }: YearNavProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function go(delta: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(year + delta));
    router.push(`/reports/annual?${params.toString()}`);
  }

  const isCurrentOrFuture = year >= new Date().getFullYear();

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
        onClick={() => go(-1)}
        aria-label="Previous year"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <span className="min-w-[80px] text-center text-sm font-semibold text-foreground">
        {year}
      </span>

      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
        onClick={() => go(1)}
        disabled={isCurrentOrFuture}
        aria-label="Next year"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
