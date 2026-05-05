"use client";

import { useState } from "react";
import {
  useForm,
  useFieldArray,
  Controller,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { usePersons } from "@/components/persons-context";
import type { SerializedCategory } from "@/lib/models/category";
import type { SerializedRecurringTemplate } from "@/lib/models/recurring-template";

const itemSchema = z.object({
  paidBy: z.string().min(1),
  categoryId: z.string().min(1, "Required"),
  amount: z
    .string()
    .min(1, "Required")
    .refine(
      (v) => /^\d+(\.\d{1,2})?$/.test(v) && parseFloat(v) > 0,
      "Enter a valid amount"
    ),
  where: z.string().min(1, "Required").max(100),
  notes: z.string().max(500).optional(),
  splitType: z.enum(["split", "full"]),
});

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  items: z.array(itemSchema).min(1, "Add at least one item"),
});

type FormValues = z.infer<typeof formSchema>;

interface TemplateFormDialogProps {
  categories: SerializedCategory[];
  paidBy: string;
  template?: SerializedRecurringTemplate;
  trigger: React.ReactElement;
}

export function TemplateFormDialog({
  categories,
  paidBy,
  template,
  trigger,
}: TemplateFormDialogProps) {
  const isEdit = !!template;
  const { personMap } = usePersons();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const defaultItems: FormValues["items"] = template
    ? template.items.map((i) => ({
        paidBy: i.paidBy,
        categoryId: i.categoryId,
        amount: (i.amount / 100).toFixed(2),
        where: i.where,
        notes: i.notes ?? "",
        splitType: i.splitType,
      }))
    : [
        {
          paidBy,
          categoryId: "",
          amount: "",
          where: "",
          notes: "",
          splitType: "split" as const,
        },
      ];

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: template?.name ?? "",
      items: defaultItems,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  function handleOpenChange(next: boolean) {
    if (next) {
      reset({
        name: template?.name ?? "",
        items: defaultItems,
      });
    }
    setOpen(next);
  }

  async function onSubmit(values: FormValues) {
    const body = {
      name: values.name,
      items: values.items.map((item) => ({
        paidBy: item.paidBy,
        categoryId: item.categoryId,
        amount: Math.round(parseFloat(item.amount) * 100),
        where: item.where,
        notes: item.notes || undefined,
        splitType: item.splitType,
      })),
    };

    const url = isEdit ? `/api/recurring/${template!._id}` : "/api/recurring";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Failed to save template");
      return;
    }

    toast.success(isEdit ? "Template updated" : "Template created");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Template" : "New Template"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the template name and items."
              : "Create a group of recurring expenses."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {/* Template name */}
          <div className="space-y-1.5">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              placeholder="e.g. Monthly Bills"
              {...register("name")}
              className={cn(errors.name && "border-destructive")}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() =>
                  append({
                    paidBy,
                    categoryId: "",
                    amount: "",
                    where: "",
                    notes: "",
                    splitType: "split",
                  })
                }
              >
                <Plus className="h-3.5 w-3.5" />
                Add Item
              </Button>
            </div>

            {errors.items?.root && (
              <p className="text-xs text-destructive">
                {errors.items.root.message}
              </p>
            )}

            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="rounded-lg border border-border bg-muted/50 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Item {index + 1}
                    </span>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Where + Amount */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor={`items.${index}.where`}>Where</Label>
                      <Input
                        id={`items.${index}.where`}
                        placeholder="FPL, Spectrum…"
                        {...register(`items.${index}.where`)}
                        className={cn(
                          errors.items?.[index]?.where && "border-destructive"
                        )}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`items.${index}.amount`}>Amount</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                          $
                        </span>
                        <Input
                          id={`items.${index}.amount`}
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          {...register(`items.${index}.amount`)}
                          className={cn(
                            "pl-6",
                            errors.items?.[index]?.amount && "border-destructive"
                          )}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Category + Paid By */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Category</Label>
                      <Controller
                        control={control}
                        name={`items.${index}.categoryId`}
                        render={({ field: f }) => (
                          <Select value={f.value} onValueChange={f.onChange}>
                            <SelectTrigger
                              className={cn(
                                errors.items?.[index]?.categoryId &&
                                  "border-destructive"
                              )}
                            >
                              <SelectValue>
                                {f.value
                                  ? categories.find((c) => c._id === f.value)
                                      ?.name
                                  : <span className="text-muted-foreground">
                                      Select…
                                    </span>}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {categories.map((c) => (
                                <SelectItem key={c._id} value={c._id}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Paid By</Label>
                      <Input
                        value={personMap.get(paidBy)?.displayName ?? paidBy}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                  </div>

                  {/* Notes + Split */}
                  <div className="flex items-end gap-3">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={`items.${index}.notes`}>
                        Notes{" "}
                        <span className="text-muted-foreground font-normal">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        id={`items.${index}.notes`}
                        placeholder="Add a note…"
                        {...register(`items.${index}.notes`)}
                      />
                    </div>
                    <Controller
                      control={control}
                      name={`items.${index}.splitType`}
                      render={({ field: f }) => (
                        <div className="flex items-center gap-2 pb-2">
                          <Checkbox
                            id={`items.${index}.splitType`}
                            checked={f.value === "split"}
                            onCheckedChange={(checked) =>
                              f.onChange(checked ? "split" : "full")
                            }
                          />
                          <Label
                            htmlFor={`items.${index}.splitType`}
                            className="font-normal cursor-pointer whitespace-nowrap"
                          >
                            50/50
                          </Label>
                        </div>
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving…"
                : isEdit
                  ? "Save Changes"
                  : "Create Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
