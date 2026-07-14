"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatMonthYear } from "@/lib/utils";
import { addMonths, clampToPast, currentYM, type YM } from "../_lib/month-range";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

interface MonthStepperProps {
  month: YM;
  label: "Baseline" | "Comparison";
  onChange: (ym: YM) => void;
}

/**
 * A single month picker with:
 * - Left/right chevron buttons for stepping one month at a time
 * - Clickable month label that opens a popover with year + 3×4 month grid
 * - Future months disabled in both steppers and the grid
 * - Fully keyboard and mouse operable
 */
export function MonthStepper({ month, label, onChange }: MonthStepperProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [popoverYear, setPopoverYear] = useState(month.year);

  const now = currentYM();

  // Check if a month is in the future
  function isFuture(ym: YM): boolean {
    return ym.year > now.year || (ym.year === now.year && ym.month > now.month);
  }

  function step(delta: number) {
    const newMonth = clampToPast(addMonths(month, delta));
    if (!isFuture(newMonth)) {
      onChange(newMonth);
    }
  }

  function selectMonth(m: number) {
    const newMonth = clampToPast({ year: popoverYear, month: m });
    if (!isFuture(newMonth)) {
      onChange(newMonth);
      setIsOpen(false);
    }
  }

  const canStepBack = !isFuture(addMonths(month, -1));
  const canStepForward = !isFuture(addMonths(month, 1));

  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 border-primary/20 hover:border-primary/40 hover:bg-primary/5 flex-shrink-0"
          onClick={() => step(-1)}
          disabled={!canStepBack}
          aria-label={`Previous month (${label})`}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger className="min-w-[140px] text-center text-sm font-semibold text-foreground hover:underline focus:outline-none focus:underline focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 rounded px-2 py-1 transition-colors">
            {formatMonthYear(month.month, month.year)}
          </PopoverTrigger>

          <PopoverContent className="w-auto p-4" align="center">
            {/* Year header with steppers */}
            <div className="mb-4 flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setPopoverYear((y) => y - 1)}
                aria-label="Previous year"
              >
                ◄
              </Button>
              <div className="min-w-[60px] text-center text-sm font-semibold">
                {popoverYear}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setPopoverYear((y) => {
                  // Don't step into future years
                  const nextYear = y + 1;
                  return nextYear <= now.year ? nextYear : y;
                })}
                disabled={popoverYear >= now.year}
                aria-label="Next year"
              >
                ►
              </Button>
            </div>

            {/* 3×4 month grid */}
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS.map((monthName, idx) => {
                const m = idx + 1;
                const ym = { year: popoverYear, month: m };
                const isFutureMonth = isFuture(ym);
                const isSelected = month.year === popoverYear && month.month === m;

                return (
                  <button
                    key={monthName}
                    onClick={() => selectMonth(m)}
                    disabled={isFutureMonth}
                    className={cn(
                      "rounded px-2 py-1.5 text-xs font-medium transition-colors",
                      "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                      isSelected
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {monthName}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 border-primary/20 hover:border-primary/40 hover:bg-primary/5 flex-shrink-0"
          onClick={() => step(1)}
          disabled={!canStepForward}
          aria-label={`Next month (${label})`}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
