"use client";

import { useState } from "react";
import { Controller, useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DatePickerField } from "@/components/date-picker-field";
import { PersonBadge } from "@/components/person-badge";
import { usePersons } from "@/components/persons-context";
import { badgeProps } from "@/lib/person-utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SerializedTag } from "@/lib/models/tag";
import type { SerializedRecurringTemplate } from "@/lib/models/recurring-template";

function today() {
  return new Date().toISOString().split("T")[0];
}

const applyFormSchema = z.object({
  date: z.string().min(1, "Date is required"),
  items: z.array(
    z.object({
      amount: z
        .string()
        .min(1, "Required")
        .refine(
          (v) => /^\d+(\.\d{1,2})?$/.test(v) && parseFloat(v) > 0,
          "Invalid amount"
        ),
    })
  ),
});

type ApplyFormValues = z.infer<typeof applyFormSchema>;

interface ApplyTemplateDialogProps {
  template: SerializedRecurringTemplate;
  tags: SerializedTag[];
  closedMonths: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApplyTemplateDialog({
  template,
  tags,
  closedMonths,
  open,
  onOpenChange,
}: ApplyTemplateDialogProps) {
  const closedSet = new Set(closedMonths);
  const { personMap } = usePersons();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const tagMap = new Map(tags.map((t) => [t._id, t.path]));

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ApplyFormValues>({
    resolver: zodResolver(applyFormSchema),
    defaultValues: {
      date: today(),
      items: template.items.map((i) => ({
        amount: (i.amount / 100).toFixed(2),
      })),
    },
  });

  const { fields } = useFieldArray({ control, name: "items" });

  const watchedDate = useWatch({ control, name: "date" });
  const dateIsSettled = (() => {
    if (!watchedDate) return false;
    const d = new Date(watchedDate);
    return closedSet.has(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`);
  })();

  function settledMonthLabel(iso: string) {
    const d = new Date(iso);
    return new Date(d.getUTCFullYear(), d.getUTCMonth()).toLocaleDateString(
      "en-US",
      { month: "long", year: "numeric" }
    );
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      reset({
        date: today(),
        items: template.items.map((i) => ({
          amount: (i.amount / 100).toFixed(2),
        })),
      });
    }
    onOpenChange(next);
  }

  async function onSubmit(values: ApplyFormValues) {
    if (dateIsSettled) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/recurring/${template._id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: values.date,
          items: values.items.map((i) => ({
            amount: Math.round(parseFloat(i.amount) * 100),
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to apply template");
        return;
      }

      const data = await res.json();
      toast.success(`${data.count} expense${data.count === 1 ? "" : "s"} created`);
      onOpenChange(false);
      router.push("/expenses");
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apply &ldquo;{template.name}&rdquo;</DialogTitle>
          <DialogDescription>
            Review and adjust amounts, then choose a date to create all expenses.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Date */}
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Controller
              control={control}
              name="date"
              render={({ field }) => (
                <DatePickerField
                  value={field.value}
                  onChange={field.onChange}
                  hasError={!!errors.date || dateIsSettled}
                />
              )}
            />
            {errors.date && (
              <p className="text-xs text-destructive">{errors.date.message}</p>
            )}
            {!errors.date && dateIsSettled && watchedDate && (
              <p className="text-xs text-destructive">
                {settledMonthLabel(watchedDate)} is already settled. Reopen the
                month first.
              </p>
            )}
          </div>

          {/* Items table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[26rem]">
              <thead>
                <tr className="border-b border-border bg-muted/60">
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                    Where
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                    Tags
                  </th>
                  <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                    Paid By
                  </th>
                  <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {fields.map((field, index) => {
                  const item = template.items[index];
                  return (
                    <tr key={field.id}>
                      <td className="px-3 py-2 font-medium">{item.where}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {item.tagIds.map((id) => tagMap.get(id) ?? "Unknown").join(", ")}
                      </td>
                      <td className="px-3 py-2">
                        <PersonBadge {...badgeProps(item.paidBy, personMap)} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="relative w-24 ml-auto">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            $
                          </span>
                          <Input
                            type="text"
                            inputMode="decimal"
                            {...register(`items.${index}.amount`)}
                            className={cn(
                              "h-8 pl-5 text-right text-sm",
                              errors.items?.[index]?.amount &&
                                "border-destructive"
                            )}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-muted/60">
                  <td
                    colSpan={3}
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    Default Total
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {formatCurrency(template.items.reduce((s, i) => s + i.amount, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || dateIsSettled}>
              {loading
                ? "Creating…"
                : `Create ${template.items.length} Expense${template.items.length === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
