"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import type { ExpenseApiInput } from "@/lib/validations/expense";

const formSchema = z.object({
  paidBy:         z.string().min(1),
  date:           z.string().min(1, "Date is required"),
  tagIds:         z.array(z.string().min(1)).min(1, "At least one tag is required"),
  amount:         z
    .string()
    .min(1, "Amount is required")
    .refine(
      (v) => /^\d+(\.\d{1,2})?$/.test(v) && parseFloat(v) > 0,
      "Enter a valid amount (e.g. 42.50)"
    ),
  where:          z.string().min(1, "Required").max(100),
  notes:          z.string().max(500).optional(),
  splitType:      z.enum(["split", "full"]),
  settlementType: z.enum(["immediate", "deferred"]),
});

type FormValues = z.infer<typeof formSchema>;

function today() {
  return new Date().toISOString().split("T")[0];
}

interface ExpenseFormProps {
  tags: SerializedTag[];
  paidBy: string;
  closedMonths: string[]; // "year-month" strings, e.g. "2026-3"
}

export function ExpenseForm({ tags: initialTags, paidBy, closedMonths }: ExpenseFormProps) {
  const [tags, setTags] = useState(initialTags);
  const closedSet = new Set(closedMonths);
  const router = useRouter();

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const dateTriggerRef = useRef<HTMLButtonElement>(null);
  const [focusTrigger, setFocusTrigger] = useState(0);

  useEffect(() => {
    if (focusTrigger > 0) {
      dateTriggerRef.current?.focus();
    }
  }, [focusTrigger]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      paidBy,
      date:           today(),
      tagIds:         [],
      amount:         "",
      where:          "",
      notes:          "",
      splitType:      "split",
      settlementType: "deferred",
    },
  });

  const watchedDate = useWatch({ control, name: "date" });
  const dateIsSettled = (() => {
    if (!watchedDate) return false;
    const d = new Date(watchedDate);
    return closedSet.has(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`);
  })();

  function settledMonthLabel(iso: string) {
    const d = new Date(iso);
    return formatMonthYear(d.getUTCMonth() + 1, d.getUTCFullYear());
  }

  async function onSubmit(values: FormValues) {
    if (dateIsSettled) return;

    const body: ExpenseApiInput = {
      paidBy:         values.paidBy,
      date:           values.date,
      tagIds:         values.tagIds,
      amount:         Math.round(parseFloat(values.amount) * 100),
      where:          values.where,
      notes:          values.notes || undefined,
      splitType:      values.splitType,
      settlementType: values.settlementType,
    };

    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Failed to save expense");
      return;
    }

    toast.success("Expense added");

    reset({
      paidBy,
      date: today(),
      tagIds: [],
      amount: "",
      where:  "",
      notes:  "",
      splitType: "split",
      settlementType: "deferred",
    });

    router.refresh();
    setFocusTrigger((c) => c + 1);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

      {/* Date + Category */}
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
                        autoFocus
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground",
                          (errors.date || dateIsSettled) && "border-destructive"
                        )}
                        onKeyDown={(e) => {
                          if (
                            (e.key === "ArrowUp" || e.key === "ArrowDown") &&
                            dateValue
                          ) {
                            e.preventDefault();
                            const delta = e.key === "ArrowUp" ? 1 : -1;
                            field.onChange(
                              format(addDays(dateValue, delta), "yyyy-MM-dd")
                            );
                          }
                        }}
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
              {settledMonthLabel(watchedDate)} is already settled. Reopen the month first.
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
                onTagCreated={(tag) => setTags((prev) => [...prev, tag])}
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
          <Label htmlFor="amount">Amount</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              $
            </span>
            <Input
              id="amount"
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
          <Label htmlFor="where">Where</Label>
          <Input
            id="where"
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
        <Label htmlFor="notes">
          Notes{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Input
          id="notes"
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
                id="splitType"
                checked={field.value === "split"}
                onCheckedChange={(checked) =>
                  field.onChange(checked ? "split" : "full")
                }
              />
              <Label htmlFor="splitType" className="font-normal cursor-pointer">
                Split 50/50
              </Label>
            </div>
          )}
        />
      </div>

      <Button type="submit" disabled={isSubmitting || dateIsSettled} className="w-full">
        {isSubmitting ? "Saving…" : "Add Expense"}
      </Button>
    </form>
  );
}
