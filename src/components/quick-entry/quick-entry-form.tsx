"use client";

import { useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SerializedTag } from "@/lib/models/tag";
import type { ExpenseApiInput } from "@/lib/validations/expense";
import { checkDuplicateExpenses } from "@/lib/duplicate-check";
import { QuickEntryTagChips } from "./quick-entry-tag-chips";

const quickEntrySchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine(
      (v) => /^\d+(\.\d{1,2})?$/.test(v) && parseFloat(v) > 0,
      "Enter a valid amount (e.g. 42.50)"
    ),
  where: z.string().min(1, "Required").max(100),
  date: z.string().min(1, "Date is required"),
  tagIds: z.array(z.string().min(1)).min(1, "At least one tag is required"),
});

type QuickEntryValues = z.infer<typeof quickEntrySchema>;

function today() {
  return new Date().toISOString().split("T")[0];
}

interface QuickEntryFormProps {
  paidBy: string;
  tags: SerializedTag[];
  recentTagIds: string[];
  onClose: () => void;
  onTagCreated: (tag: SerializedTag) => void;
}

export function QuickEntryForm({
  paidBy,
  tags,
  recentTagIds,
  onClose,
  onTagCreated,
}: QuickEntryFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const saveModeRef = useRef<"close" | "another">("close");
  const amountRef = useRef<HTMLInputElement | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    formState: { errors },
  } = useForm<QuickEntryValues>({
    resolver: zodResolver(quickEntrySchema),
    defaultValues: {
      amount: "",
      where: "",
      date: today(),
      tagIds: [],
    },
  });

  const { ref: amountRegRef, ...amountRest } = register("amount");

  async function onSubmit(values: QuickEntryValues) {
    setSaving(true);
    try {
      const amountCents = Math.round(parseFloat(values.amount) * 100);

      const body: ExpenseApiInput = {
        paidBy,
        date: values.date,
        tagIds: values.tagIds,
        amount: amountCents,
        where: values.where,
        notes: undefined,
        splitType: "split",
        settlementType: "deferred",
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

      const savedId: string | undefined = (await res.json()).expense?._id;
      toast.success("Expense added");
      router.refresh();

      checkDuplicateExpenses(values.date, amountCents, savedId).then((matches) => {
        if (matches.length > 0) {
          const match = matches[0];
          toast("Possible duplicate", {
            description: `This looks similar to a $${(match.amount / 100).toFixed(2)} expense at ${match.where} on the same day.`,
          });
        }
      });

      if (saveModeRef.current === "another") {
        reset({ amount: "", where: "", date: today(), tagIds: [] });
        setTimeout(() => amountRef.current?.focus(), 0);
      } else {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      saveModeRef.current = "another";
      handleSubmit(onSubmit)();
    }
  }

  function handleFullForm() {
    const values = getValues();
    const params = new URLSearchParams();
    if (values.amount) params.set("prefill_amount", values.amount);
    if (values.where) params.set("prefill_where", values.where);
    if (values.date) params.set("prefill_date", values.date);
    if (values.tagIds.length > 0) params.set("prefill_tags", values.tagIds.join(","));
    onClose();
    router.push(`/expenses?${params.toString()}`);
  }

  return (
    <form
      onSubmit={(e) => {
        saveModeRef.current = "close";
        handleSubmit(onSubmit)(e);
      }}
      onKeyDown={handleKeyDown}
      className="space-y-4"
    >
      <div className="space-y-1.5">
        <Label htmlFor="quick-amount">Amount</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            $
          </span>
          <Input
            id="quick-amount"
            placeholder="0.00"
            inputMode="decimal"
            autoFocus
            className="pl-7"
            {...amountRest}
            ref={(el) => {
              amountRegRef(el);
              amountRef.current = el;
            }}
          />
        </div>
        {errors.amount && (
          <p className="text-xs text-destructive">{errors.amount.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="quick-where">Where</Label>
        <Input
          id="quick-where"
          placeholder="Publix, Amazon, etc."
          {...register("where")}
        />
        {errors.where && (
          <p className="text-xs text-destructive">{errors.where.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="quick-date">Date</Label>
        <Input
          id="quick-date"
          type="date"
          {...register("date")}
        />
        {errors.date && (
          <p className="text-xs text-destructive">{errors.date.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Tags</Label>
        <Controller
          control={control}
          name="tagIds"
          render={({ field }) => (
            <QuickEntryTagChips
              tags={tags}
              recentTagIds={recentTagIds}
              selectedTagIds={field.value}
              onSelectedChange={field.onChange}
              onTagCreated={onTagCreated}
            />
          )}
        />
        {errors.tagIds && (
          <p className="text-xs text-destructive">{errors.tagIds.message}</p>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="submit" disabled={saving} aria-busy={saving} className="flex-1">
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          className="flex-1"
          onClick={() => {
            saveModeRef.current = "another";
            handleSubmit(onSubmit)();
          }}
        >
          Save & add another
        </Button>
      </div>

      <button
        type="button"
        onClick={handleFullForm}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Need more options? Full form
        <ArrowRight className="h-3 w-3" />
      </button>
    </form>
  );
}
