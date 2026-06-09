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
import type { SerializedCsvFormat } from "@/lib/models/csv-format";
import type { SerializedTag } from "@/lib/models/tag";
import {
  csvFormatFormSchema,
  type CsvFormatFormValues,
} from "./csv-format-field-schema";
import { CsvFormatColumnFields } from "./csv-format-column-fields";
import { CsvFormatTagMappings } from "./csv-format-tag-mappings";

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

  const defaultValues: CsvFormatFormValues = {
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

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CsvFormatFormValues>({
    resolver: zodResolver(csvFormatFormSchema),
    defaultValues,
  });

  const amountType = useWatch({ control, name: "amountType" });
  const tagColumn = useWatch({ control, name: "tagColumn" });

  function handleOpenChange(next: boolean) {
    if (next) reset(defaultValues);
    setOpen(next);
  }

  async function onSubmit(values: CsvFormatFormValues) {
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
            <CsvFormatColumnFields
              control={control}
              register={register}
              errors={errors}
              amountType={amountType}
            />

            {tagColumn && tagColumn.trim() !== "" && (
              <CsvFormatTagMappings
                control={control}
                register={register}
                errors={errors}
                tags={tags}
                onTagCreated={(tag) => setTags((prev) => [...prev, tag])}
              />
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
