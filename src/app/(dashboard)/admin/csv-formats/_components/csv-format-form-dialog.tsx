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

const EMPTY_FORM: CsvFormatFormValues = {
  name: "",
  dateColumn: "",
  dateFormat: "MM/DD/YYYY",
  descriptionColumn: "",
  amountType: "separate",
  debitColumn: "",
  creditColumn: "",
  amountColumn: "",
  purchaseSign: undefined,
  tagColumn: "",
  notesColumn: "",
  tagMappings: [],
};

function buildDefaultValues(format?: SerializedCsvFormat): CsvFormatFormValues {
  if (!format) return { ...EMPTY_FORM };
  return {
    name: format.name,
    dateColumn: format.dateColumn,
    dateFormat: format.dateFormat,
    descriptionColumn: format.descriptionColumn,
    amountType: format.amountType,
    debitColumn: format.debitColumn ?? "",
    creditColumn: format.creditColumn ?? "",
    amountColumn: format.amountColumn ?? "",
    purchaseSign: format.purchaseSign,
    tagColumn: format.tagColumn ?? "",
    notesColumn: format.notesColumn ?? "",
    tagMappings: format.tagMappings,
  };
}

type FieldError = { field: keyof CsvFormatFormValues; message: string };

function validateAmountFields(values: CsvFormatFormValues): FieldError[] {
  const errors: FieldError[] = [];
  if (values.amountType === "separate") {
    if (!values.debitColumn) errors.push({ field: "debitColumn", message: "Debit column is required" });
    if (!values.creditColumn) errors.push({ field: "creditColumn", message: "Credit column is required" });
  }
  if (values.amountType === "single") {
    if (!values.amountColumn) errors.push({ field: "amountColumn", message: "Amount column is required" });
    if (!values.purchaseSign) errors.push({ field: "purchaseSign", message: "Purchase sign is required" });
  }
  return errors;
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

  const defaultValues = buildDefaultValues(format);

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
    const fieldErrors = validateAmountFields(values);
    if (fieldErrors.length > 0) {
      for (const e of fieldErrors) setError(e.field, { message: e.message });
      return;
    }

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

            <DialogFooter>
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
