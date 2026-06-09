"use client";

import { type RefObject, useState } from "react";
import { type Control, type FieldErrors, Controller, type UseFormRegister } from "react-hook-form";
import { addDays, format, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn, formatMonthYear } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TagPicker } from "@/components/tag-picker";
import { SettlementTypeSelect } from "@/components/settlement-type-select";
import type { SerializedTag } from "@/lib/models/tag";
import type { ExpenseFieldValues } from "./expense-field-schema";

interface ExpenseFormFieldsProps {
  control: Control<ExpenseFieldValues>;
  register: UseFormRegister<ExpenseFieldValues>;
  errors: FieldErrors<ExpenseFieldValues>;
  tags: SerializedTag[];
  onTagCreated: (tag: SerializedTag) => void;
  dateIsSettled: boolean;
  watchedDate: string;
  idPrefix?: string;
  dateTriggerRef?: RefObject<HTMLButtonElement | null>;
  autoFocusDate?: boolean;
  enableDateArrowKeys?: boolean;
}

function settledMonthLabel(iso: string) {
  const d = new Date(iso);
  return formatMonthYear(d.getUTCMonth() + 1, d.getUTCFullYear());
}

export function ExpenseFormFields({
  control,
  register,
  errors,
  tags,
  onTagCreated,
  dateIsSettled,
  watchedDate,
  idPrefix = "",
  dateTriggerRef,
  autoFocusDate,
  enableDateArrowKeys,
}: ExpenseFormFieldsProps) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  return (
    <>
      {/* Date + Tags */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Controller
            control={control}
            name="date"
            render={({ field }) => {
              const dateValue = field.value
                ? parse(field.value, "yyyy-MM-dd", new Date())
                : undefined;
              return (
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen} modal="trap-focus">
                  <PopoverTrigger
                    render={
                      <Button
                        ref={dateTriggerRef}
                        variant="outline"
                        autoFocus={autoFocusDate}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground",
                          (errors.date || dateIsSettled) && "border-destructive"
                        )}
                        onKeyDown={
                          enableDateArrowKeys && dateValue
                            ? (e) => {
                                if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                                  e.preventDefault();
                                  const delta = e.key === "ArrowUp" ? 1 : -1;
                                  field.onChange(
                                    format(addDays(dateValue, delta), "yyyy-MM-dd")
                                  );
                                }
                              }
                            : undefined
                        }
                      />
                    }
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {field.value
                      ? format(dateValue!, "MMMM d, yyyy")
                      : "Pick a date"}
                  </PopoverTrigger>
                  <PopoverContent align="start">
                    <Calendar
                      mode="single"
                      selected={dateValue}
                      onSelect={(date) => {
                        if (date) {
                          field.onChange(format(date, "yyyy-MM-dd"));
                        }
                        setDatePickerOpen(false);
                      }}
                      defaultMonth={dateValue}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
              );
            }}
          />
          {errors.date && (
            <p className="text-xs text-destructive">{errors.date.message}</p>
          )}
          {!errors.date && dateIsSettled && watchedDate && (
            <p className="text-xs text-destructive">
              {settledMonthLabel(watchedDate)} is already settled.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Tags</Label>
          <Controller
            control={control}
            name="tagIds"
            render={({ field }) => (
              <TagPicker
                tags={tags}
                selectedTagIds={field.value}
                onSelectedChange={field.onChange}
                onTagCreated={onTagCreated}
                error={!!errors.tagIds}
              />
            )}
          />
          {errors.tagIds && (
            <p className="text-xs text-destructive">{errors.tagIds.message}</p>
          )}
        </div>
      </div>

      {/* Amount + Where */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}amount`}>Amount</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              id={`${idPrefix}amount`}
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              {...register("amount")}
              className={cn("pl-6", errors.amount && "border-destructive")}
            />
          </div>
          {errors.amount && (
            <p className="text-xs text-destructive">{errors.amount.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`${idPrefix}where`}>Where</Label>
          <Input
            id={`${idPrefix}where`}
            type="text"
            placeholder="Publix, Amazon, FPL…"
            {...register("where")}
            className={cn(errors.where && "border-destructive")}
          />
          {errors.where && (
            <p className="text-xs text-destructive">{errors.where.message}</p>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}notes`}>
          Notes{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id={`${idPrefix}notes`}
          type="text"
          placeholder="Add a note…"
          {...register("notes")}
        />
      </div>

      {/* Settlement type + Split */}
      <div className="flex items-end justify-between">
        <div className="space-y-1.5">
          <Label>Settlement</Label>
          <Controller
            control={control}
            name="settlementType"
            render={({ field }) => (
              <SettlementTypeSelect
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
        </div>

        <Controller
          control={control}
          name="splitType"
          render={({ field }) => (
            <div className="flex items-center gap-2.5 pb-2">
              <Checkbox
                id={`${idPrefix}splitType`}
                checked={field.value === "split"}
                onCheckedChange={(checked) =>
                  field.onChange(checked ? "split" : "full")
                }
              />
              <Label htmlFor={`${idPrefix}splitType`} className="font-normal cursor-pointer">
                Split 50/50
              </Label>
            </div>
          )}
        />
      </div>
    </>
  );
}

export function isDateInSettledMonth(date: string, closedMonths: string[]): boolean {
  if (!date) return false;
  const d = new Date(date);
  const closedSet = new Set(closedMonths);
  return closedSet.has(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`);
}
