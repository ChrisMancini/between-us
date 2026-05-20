"use client";

import { useState } from "react";
import { useForm, Controller, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { TagPicker } from "@/components/tag-picker";
import type { SerializedCsvFormat } from "@/lib/models/csv-format";
import type { SerializedTag } from "@/lib/models/tag";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  dateColumn: z.string().min(1, "Date column is required").max(100),
  dateFormat: z.enum(["MM/DD/YYYY", "YYYY-MM-DD", "MM-DD-YYYY", "DD/MM/YYYY"]),
  descriptionColumn: z.string().min(1, "Merchant / Location column is required").max(100),
  amountType: z.enum(["separate", "single"]),
  debitColumn: z.string().max(100).optional(),
  creditColumn: z.string().max(100).optional(),
  amountColumn: z.string().max(100).optional(),
  purchaseSign: z.enum(["positive", "negative"]).optional(),
  tagColumn: z.string().max(100).optional(),
  notesColumn: z.string().max(100).optional(),
  tagMappings: z
    .array(
      z.object({
        sourceValue: z.string().min(1, "Source value is required"),
        tagIds: z.array(z.string()).min(1, "At least one tag is required"),
      })
    )
    .optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface CsvFormatFormDialogProps {
  format?: SerializedCsvFormat;
  tags: SerializedTag[];
  trigger: React.ReactElement;
}

export function CsvFormatFormDialog({
  format,
  tags: initialTags,
  trigger,
}: CsvFormatFormDialogProps) {
  const isEdit = !!format;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tags, setTags] = useState(initialTags);

  const defaultValues: FormValues = {
    name: format?.name ?? "",
    dateColumn: format?.dateColumn ?? "",
    dateFormat: format?.dateFormat ?? "MM/DD/YYYY",
    descriptionColumn: format?.descriptionColumn ?? "",
    amountType: format?.amountType ?? "separate",
    debitColumn: format?.debitColumn ?? "",
    creditColumn: format?.creditColumn ?? "",
    amountColumn: format?.amountColumn ?? "",
    purchaseSign: format?.purchaseSign,
    tagColumn: format?.tagColumn ?? "",
    notesColumn: format?.notesColumn ?? "",
    tagMappings: format?.tagMappings ?? [],
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "tagMappings",
  });

  const amountType = useWatch({ control, name: "amountType" });
  const tagColumn = useWatch({ control, name: "tagColumn" });

  function handleOpenChange(next: boolean) {
    if (next) reset(defaultValues);
    setOpen(next);
  }

  async function onSubmit(values: FormValues) {
    let hasError = false;
    if (values.amountType === "separate") {
      if (!values.debitColumn) {
        setError("debitColumn", { message: "Debit column is required" });
        hasError = true;
      }
      if (!values.creditColumn) {
        setError("creditColumn", { message: "Credit column is required" });
        hasError = true;
      }
    }
    if (values.amountType === "single") {
      if (!values.amountColumn) {
        setError("amountColumn", { message: "Amount column is required" });
        hasError = true;
      }
      if (!values.purchaseSign) {
        setError("purchaseSign", { message: "Purchase sign is required" });
        hasError = true;
      }
    }
    if (hasError) return;

    const url = isEdit
      ? `/api/csv-formats/${format!._id}`
      : "/api/csv-formats";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Failed to save format");
      return;
    }

    toast.success(isEdit ? "Format updated" : "Format created");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit Format" : "New CSV Format"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update the column mappings for this CSV format."
                : "Define how to parse a credit card CSV export."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="format-name">Name</Label>
              <Input
                id="format-name"
                placeholder="e.g. Citi Card"
                {...register("name")}
                className={cn(errors.name && "border-destructive")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Date Column + Date Format */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="date-column">Date Column</Label>
                <Input
                  id="date-column"
                  placeholder="e.g. Date"
                  {...register("dateColumn")}
                  className={cn(errors.dateColumn && "border-destructive")}
                />
                {errors.dateColumn && (
                  <p className="text-xs text-destructive">
                    {errors.dateColumn.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Date Format</Label>
                <Controller
                  control={control}
                  name="dateFormat"
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                        <SelectItem value="MM-DD-YYYY">MM-DD-YYYY</SelectItem>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            {/* Description Column */}
            <div className="space-y-1.5">
              <Label htmlFor="desc-column">Merchant / Location Column</Label>
              <Input
                id="desc-column"
                placeholder="e.g. Description"
                {...register("descriptionColumn")}
                className={cn(errors.descriptionColumn && "border-destructive")}
              />
              {errors.descriptionColumn && (
                <p className="text-xs text-destructive">
                  {errors.descriptionColumn.message}
                </p>
              )}
            </div>

            {/* Notes Column (optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="notes-column">
                Notes Column{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="notes-column"
                placeholder="e.g. Memo"
                {...register("notesColumn")}
              />
              <p className="text-xs text-muted-foreground">
                If the CSV includes a memo or notes column, enter the header
                name to populate expense notes.
              </p>
            </div>

            {/* Amount Type */}
            <div className="space-y-1.5">
              <Label>Amount Type</Label>
              <Controller
                control={control}
                name="amountType"
                render={({ field: f }) => (
                  <Select value={f.value} onValueChange={f.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {f.value === "separate"
                          ? "Separate Debit/Credit columns"
                          : "Single Amount column"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="separate">
                        Separate Debit/Credit columns
                      </SelectItem>
                      <SelectItem value="single">
                        Single Amount column
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {/* Conditional: Separate columns */}
            {amountType === "separate" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="debit-column">Debit Column (purchases)</Label>
                  <Input
                    id="debit-column"
                    placeholder="e.g. Debit"
                    {...register("debitColumn")}
                    className={cn(errors.debitColumn && "border-destructive")}
                  />
                  {errors.debitColumn && (
                    <p className="text-xs text-destructive">
                      {errors.debitColumn.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="credit-column">Credit Column (payments)</Label>
                  <Input
                    id="credit-column"
                    placeholder="e.g. Credit"
                    {...register("creditColumn")}
                    className={cn(errors.creditColumn && "border-destructive")}
                  />
                  {errors.creditColumn && (
                    <p className="text-xs text-destructive">
                      {errors.creditColumn.message}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Conditional: Single column */}
            {amountType === "single" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="amount-column">Amount Column</Label>
                  <Input
                    id="amount-column"
                    placeholder="e.g. Amount"
                    {...register("amountColumn")}
                    className={cn(errors.amountColumn && "border-destructive")}
                  />
                  {errors.amountColumn && (
                    <p className="text-xs text-destructive">
                      {errors.amountColumn.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Purchase Sign</Label>
                  <Controller
                    control={control}
                    name="purchaseSign"
                    render={({ field: f }) => (
                      <Select
                        value={f.value ?? ""}
                        onValueChange={f.onChange}
                      >
                        <SelectTrigger
                          className={cn(
                            "w-full",
                            errors.purchaseSign && "border-destructive"
                          )}
                        >
                          <SelectValue placeholder="Select...">
                            {f.value === "positive"
                              ? "Purchases are positive"
                              : f.value === "negative"
                                ? "Purchases are negative"
                                : null}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="positive">
                            Purchases are positive
                          </SelectItem>
                          <SelectItem value="negative">
                            Purchases are negative
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.purchaseSign && (
                    <p className="text-xs text-destructive">
                      {errors.purchaseSign.message}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Tag Column (optional) */}
            <div className="space-y-1.5">
              <Label htmlFor="tag-column">
                Tag Column{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="tag-column"
                placeholder="e.g. Tag, Category, Type"
                {...register("tagColumn")}
              />
              <p className="text-xs text-muted-foreground">
                If the CSV includes a category or tag column, enter the header
                name to enable tag mapping.
              </p>
            </div>

            {/* Tag Mappings (shown when tagColumn is set) */}
            {tagColumn && tagColumn.trim() !== "" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Tag Mappings</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-7 text-xs"
                    onClick={() =>
                      append({ sourceValue: "", tagIds: [] })
                    }
                  >
                    <Plus className="h-3 w-3" />
                    Add Mapping
                  </Button>
                </div>

                {fields.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No mappings yet. Unmapped values will need tags assigned
                    during import.
                  </p>
                )}

                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex items-start gap-2">
                      <div className="flex-1 space-y-1">
                        <Input
                          placeholder="CSV category value"
                          {...register(
                            `tagMappings.${index}.sourceValue`
                          )}
                          className={cn(
                            "h-8 text-sm",
                            errors.tagMappings?.[index]?.sourceValue &&
                              "border-destructive"
                          )}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground mt-2">
                        &rarr;
                      </span>
                      <div className="flex-1 space-y-1">
                        <Controller
                          control={control}
                          name={`tagMappings.${index}.tagIds`}
                          render={({ field: f }) => (
                            <TagPicker
                              tags={tags}
                              selectedTagIds={f.value ?? []}
                              onSelectedChange={f.onChange}
                              onTagCreated={(tag) =>
                                setTags((prev) => [...prev, tag])
                              }
                              error={!!errors.tagMappings?.[index]?.tagIds}
                            />
                          )}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="mt-1 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(index)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                    : "Create Format"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
    </Dialog>
  );
}
