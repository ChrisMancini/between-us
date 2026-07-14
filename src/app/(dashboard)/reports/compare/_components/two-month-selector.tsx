"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ymToParam, type YM } from "../_lib/month-range";
import { MonthStepper } from "./month-stepper";

interface TwoMonthSelectorProps {
  from: YM;
  to: YM;
}

/**
 * Interactive selection strip for choosing two months in a comparison.
 * - Two MonthStepper components side-by-side (Baseline on left, Comparison on right)
 * - Each stepper has left/right buttons for stepping one month at a time
 * - Click month label to open popover with year+month grid for distant/cross-year jumps
 * - Swap button flips from/to (the delta sign inverts)
 * - Future months disabled in both
 * - Fully keyboard and mouse operable
 * - Stacks vertically below sm breakpoint
 */
export function TwoMonthSelector({ from, to }: TwoMonthSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateSelection(newFrom: YM, newTo: YM) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", ymToParam(newFrom));
    params.set("to", ymToParam(newTo));
    router.push(`/reports/compare?${params.toString()}`);
  }

  function handleFromChange(newFrom: YM) {
    updateSelection(newFrom, to);
  }

  function handleToChange(newTo: YM) {
    updateSelection(from, newTo);
  }

  function handleSwap() {
    updateSelection(to, from);
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4 sm:items-center sm:flex-row rounded-lg border border-primary/10 bg-card p-4">
      <MonthStepper month={from} label="Baseline" onChange={handleFromChange} />

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 self-end sm:self-center flex-shrink-0"
        onClick={handleSwap}
        aria-label="Swap months"
        title="Swap baseline and comparison months"
      >
        <ArrowRightLeft className="h-4 w-4" />
      </Button>

      <MonthStepper month={to} label="Comparison" onChange={handleToChange} />
    </div>
  );
}
