"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { SerializedTag } from "@/lib/models/tag";
import type { SerializedExpense } from "@/lib/models/expense";
import { expenseFieldSchema, type ExpenseFieldValues } from "./expense-field-schema";
import { ExpenseFormFields, isDateInSettledMonth } from "./expense-form-fields";

interface EditExpenseDialogProps {
  expense: SerializedExpense;
  tags: SerializedTag[];
  closedMonths: string[];
  trigger: React.ReactElement;
}

export function EditExpenseDialog({
  expense,
  tags: initialTags,
  closedMonths,
  trigger,
}: EditExpenseDialogProps) {
  const [tags, setTags] = useState(initialTags);
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const defaultValues: ExpenseFieldValues = {
    date:           expense.date.split("T")[0],
    tagIds:         expense.tags.map((t) => t._id),
    amount:         (expense.amount / 100).toFixed(2),
    where:          expense.where,
    notes:          expense.notes ?? "",
    splitType:      expense.splitType,
    settlementType: expense.settlementType,
  };

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFieldValues>({
    resolver: zodResolver(expenseFieldSchema),
    defaultValues,
  });

  const watchedDate = useWatch({ control, name: "date" });
  const dateIsSettled = isDateInSettledMonth(watchedDate, closedMonths);

  function handleOpenChange(next: boolean) {
    if (next) reset(defaultValues);
    setOpen(next);
  }

  async function onSubmit(values: ExpenseFieldValues) {
    if (dateIsSettled) return;

    const body = {
      date:           values.date,
      tagIds:         values.tagIds,
      amount:         Math.round(parseFloat(values.amount) * 100),
      where:          values.where,
      notes:          values.notes || undefined,
      splitType:      values.splitType,
      settlementType: values.settlementType,
    };

    const res = await fetch(`/api/expenses/${expense._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Failed to update expense");
      return;
    }

    toast.success("Expense updated");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Expense</DialogTitle>
          <DialogDescription>
            Update the details for this expense.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <ExpenseFormFields
            control={control}
            register={register}
            errors={errors}
            tags={tags}
            onTagCreated={(tag) => setTags((prev) => [...prev, tag])}
            dateIsSettled={dateIsSettled}
            watchedDate={watchedDate}
            idPrefix="edit-"
          />

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || dateIsSettled}>
              {isSubmitting ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
