"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { SerializedTag } from "@/lib/models/tag";
import type { ExpenseApiInput } from "@/lib/validations/expense";
import { expenseFieldSchema, type ExpenseFieldValues } from "./expense-field-schema";
import { ExpenseFormFields, isDateInSettledMonth } from "./expense-form-fields";

const formSchema = expenseFieldSchema.extend({
  paidBy: z.string().min(1),
});

type FormValues = z.infer<typeof formSchema>;

function today() {
  return new Date().toISOString().split("T")[0];
}

interface ExpenseFormProps {
  tags: SerializedTag[];
  paidBy: string;
  closedMonths: string[];
}

export function ExpenseForm({ tags: initialTags, paidBy, closedMonths }: ExpenseFormProps) {
  const [tags, setTags] = useState(initialTags);
  const router = useRouter();

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
  const dateIsSettled = isDateInSettledMonth(watchedDate, closedMonths);

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
      <ExpenseFormFields
        control={control as unknown as import("react-hook-form").Control<ExpenseFieldValues>}
        register={register as unknown as import("react-hook-form").UseFormRegister<ExpenseFieldValues>}
        errors={errors}
        tags={tags}
        onTagCreated={(tag) => setTags((prev) => [...prev, tag])}
        dateIsSettled={dateIsSettled}
        watchedDate={watchedDate}
        dateTriggerRef={dateTriggerRef}
        autoFocusDate
        enableDateArrowKeys
      />

      <Button type="submit" disabled={isSubmitting || dateIsSettled} className="w-full">
        {isSubmitting ? "Saving…" : "Add Expense"}
      </Button>
    </form>
  );
}
