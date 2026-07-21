"use client";

import { useState } from "react";
import { format, isSameDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getDateRangePresets, type DateRangePreset } from "@/lib/date-range-presets";

interface DateRangePickerProps {
  /** The committed range, or `undefined` for "all time". */
  value: DateRange | undefined;
  /** Fired once a full range is chosen (both ends), a preset is picked, or cleared. */
  onChange: (range: DateRange | undefined) => void;
  className?: string;
}

/** Human label for the trigger — a single day, a range, or "All time". */
function formatRangeLabel(range: DateRange | undefined): string {
  if (!range?.from) return "All time";
  const { from, to } = range;
  if (!to || isSameDay(from, to)) return format(from, "MMM d, yyyy");
  const sameYear = from.getFullYear() === to.getFullYear();
  return `${format(from, sameYear ? "MMM d" : "MMM d, yyyy")} – ${format(
    to,
    "MMM d, yyyy"
  )}`;
}

function matchesPreset(
  range: DateRange | undefined,
  preset: DateRangePreset
): boolean {
  if (!range?.from || !range.to || !preset.range.from || !preset.range.to) {
    return false;
  }
  return (
    isSameDay(range.from, preset.range.from) &&
    isSameDay(range.to, preset.range.to)
  );
}

/**
 * A date-range filter: a Button trigger opening a ShadCN Calendar (range mode)
 * beside quick-select presets, in a Popover. Selection is held in local draft
 * state and only committed via `onChange` once both ends are chosen (or a preset
 * is picked), so a URL-driven caller isn't hit with a half-finished range on the
 * first click. Selected state is conveyed by fill + weight, not colour alone.
 */
export function DateRangePicker({
  value,
  onChange,
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(value);
  const presets = getDateRangePresets(new Date());
  const hasValue = Boolean(value?.from);

  function handleOpenChange(next: boolean) {
    // Re-seed the draft from the committed value each time the popover opens so a
    // dismissed, half-finished selection never leaks into the next session.
    if (next) setDraft(value);
    setOpen(next);
  }

  function handleSelect(range: DateRange | undefined) {
    setDraft(range);
    if (range?.from && range.to) {
      onChange(range);
      setOpen(false);
    }
  }

  function applyPreset(range: DateRange) {
    setDraft(range);
    onChange(range);
    setOpen(false);
  }

  function clear() {
    setDraft(undefined);
    onChange(undefined);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <div className="relative flex items-center">
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              className={cn(
                "h-8 justify-start gap-1.5 font-normal",
                !hasValue && "text-muted-foreground",
                hasValue && "pr-7",
                className
              )}
            />
          }
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
          {formatRangeLabel(value)}
        </PopoverTrigger>
        {hasValue && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={clear}
            aria-label="Clear date range"
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      <PopoverContent
        align="start"
        className="flex w-auto flex-col gap-2 p-2 sm:flex-row sm:gap-0"
      >
        <div className="flex flex-row flex-wrap gap-1 sm:w-36 sm:flex-col sm:border-r sm:pr-2">
          {presets.map((preset) => {
            const active = matchesPreset(draft, preset);
            return (
              <Button
                key={preset.label}
                variant={active ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "justify-start font-normal",
                  active && "font-semibold"
                )}
                onClick={() => applyPreset(preset.range)}
              >
                {preset.label}
              </Button>
            );
          })}
          <Button
            variant={!draft?.from ? "secondary" : "ghost"}
            size="sm"
            className={cn(
              "justify-start font-normal",
              !draft?.from && "font-semibold"
            )}
            onClick={clear}
          >
            All time
          </Button>
        </div>
        <div className="sm:pl-2">
          <Calendar
            mode="range"
            selected={draft}
            onSelect={handleSelect}
            defaultMonth={draft?.from}
            autoFocus
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
