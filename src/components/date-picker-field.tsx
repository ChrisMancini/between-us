"use client";

import { type RefObject, useState } from "react";
import { addDays, format, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerFieldProps {
  /** Selected date as a `"yyyy-MM-dd"` string, or `""` when empty. */
  value: string;
  /** Called with the new `"yyyy-MM-dd"` string when a date is picked. */
  onChange: (value: string) => void;
  /** Draw the trigger with the destructive border (validation / guard failures). */
  hasError?: boolean;
  triggerRef?: RefObject<HTMLButtonElement | null>;
  autoFocus?: boolean;
  /** Allow ArrowUp / ArrowDown on the trigger to step the date by a day. */
  enableArrowKeys?: boolean;
}

/**
 * Themed date picker: a Button trigger opening a ShadCN Calendar in a Popover.
 * Works with a `"yyyy-MM-dd"` string value so it drops straight into a
 * react-hook-form `Controller` (`value={field.value}` / `onChange={field.onChange}`).
 */
export function DatePickerField({
  value,
  onChange,
  hasError,
  triggerRef,
  autoFocus,
  enableArrowKeys,
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const dateValue = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen} modal="trap-focus">
      <PopoverTrigger
        render={
          <Button
            ref={triggerRef}
            variant="outline"
            autoFocus={autoFocus}
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground",
              hasError && "border-destructive"
            )}
            onKeyDown={
              enableArrowKeys && dateValue
                ? (e) => {
                    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                      e.preventDefault();
                      const delta = e.key === "ArrowUp" ? 1 : -1;
                      onChange(format(addDays(dateValue, delta), "yyyy-MM-dd"));
                    }
                  }
                : undefined
            }
          />
        }
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {value ? format(dateValue!, "MMMM d, yyyy") : "Pick a date"}
      </PopoverTrigger>
      <PopoverContent align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={(date) => {
            if (date) {
              onChange(format(date, "yyyy-MM-dd"));
            }
            setOpen(false);
          }}
          defaultMonth={dateValue}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
