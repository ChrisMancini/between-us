"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SerializedTag } from "@/lib/models/tag";
import type { CsvParseResult } from "@/lib/csv-parsers/types";
import type { SkippedRow } from "@/lib/csv-parsers/types";
import type { SerializedCsvFormat } from "@/lib/models/csv-format";
import { FileUploadStep } from "./file-upload-step";
import { PreviewTable, type ImportRow } from "./preview-table";
import { ImportResult } from "./import-result";

type Step = "upload" | "preview" | "result";

interface CsvImportFormProps {
  tags: SerializedTag[];
  formats: SerializedCsvFormat[];
  paidBy: string;
  closedMonths: string[];
}

interface ResultData {
  imported: number;
  dateRange: { from: string; to: string };
  totalCents: number;
}

export function CsvImportForm({
  tags: initialTags,
  formats,
  paidBy,
}: CsvImportFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [skippedRows, setSkippedRows] = useState<SkippedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ResultData | null>(null);
  const [tags, setTags] = useState(initialTags);

  const miscTag = tags.find(
    (t) => t.name.toLowerCase() === "miscellaneous"
  );
  const defaultTagIds = miscTag ? [miscTag._id] : tags[0] ? [tags[0]._id] : [];

  async function handleParsed(parseResult: CsvParseResult) {
    const { transactions, skipped } = parseResult;

    // Check for duplicates
    const dates = transactions.map((t) => t.date);
    const minDate = dates.reduce((a, b) => (a < b ? a : b));
    const maxDate = dates.reduce((a, b) => (a > b ? a : b));

    let existingExpenses: Array<{ date: string; amount: number; where: string }> = [];

    try {
      const res = await fetch(
        `/api/expenses/check-duplicates?startDate=${minDate}&endDate=${maxDate}`
      );
      if (res.ok) {
        const data = await res.json();
        existingExpenses = data.expenses;
      }
    } catch {
      // Duplicate detection is best-effort
    }

    const existingSet = new Map<string, string>();
    for (const e of existingExpenses) {
      const dateKey = e.date.split("T")[0];
      const key = `${dateKey}|${e.amount}`;
      existingSet.set(key, e.where);
    }

    const importRows: ImportRow[] = transactions.map((t, i) => {
      const key = `${t.date}|${t.amountCents}`;
      const dupWhere = existingSet.get(key);
      const isDuplicate = dupWhere !== undefined;

      return {
        id: `row-${i}`,
        date: t.date,
        originalDescription: t.description,
        where: t.description,
        notes: t.notes ?? "",
        amountCents: t.amountCents,
        originalRow: t.originalRow,
        tagIds: t.mappedTagIds ?? defaultTagIds,
        sourceTag: t.sourceTag,
        splitType: "split" as const,
        settlementType: "deferred" as const,
        selected: !isDuplicate,
        isDuplicate,
        duplicateWhere: dupWhere,
      };
    });

    setRows(importRows);
    setSkippedRows(skipped);
    setStep("preview");
  }

  async function handleImport() {
    const selectedRows = rows.filter((r) => r.selected);
    if (selectedRows.length === 0) return;

    setImporting(true);

    try {
      const expenses = selectedRows.map((r) => ({
        paidBy,
        date: `${r.date}T00:00:00.000Z`,
        tagIds: r.tagIds,
        amount: r.amountCents,
        where: r.where.trim() || r.originalDescription,
        notes: r.notes.trim() || undefined,
        splitType: r.splitType,
        settlementType: r.settlementType,
      }));

      const res = await fetch("/api/expenses/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expenses }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Import failed");
        return;
      }

      const data = await res.json();

      const dates = selectedRows.map((r) => r.date);
      const minDate = dates.reduce((a, b) => (a < b ? a : b));
      const maxDate = dates.reduce((a, b) => (a > b ? a : b));

      const formatDate = (d: string) =>
        new Date(d + "T00:00:00Z").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        });

      setResult({
        imported: data.imported,
        dateRange: { from: formatDate(minDate), to: formatDate(maxDate) },
        totalCents: selectedRows.reduce((s, r) => s + r.amountCents, 0),
      });

      setStep("result");
      toast.success(`Imported ${data.imported} expenses`);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setImporting(false);
    }
  }

  function handleReset() {
    setStep("upload");
    setRows([]);
    setSkippedRows([]);
    setResult(null);
  }

  if (step === "result" && result) {
    return (
      <ImportResult
        imported={result.imported}
        dateRange={result.dateRange}
        totalCents={result.totalCents}
        onReset={handleReset}
      />
    );
  }

  if (step === "preview") {
    return (
      <PreviewTable
        rows={rows}
        skippedRows={skippedRows}
        tags={tags}
        onTagCreated={(tag) => setTags((prev) => [...prev, tag])}
        importing={importing}
        onRowsChange={setRows}
        onImport={handleImport}
        onBack={handleReset}
      />
    );
  }

  return <FileUploadStep formats={formats} onParsed={handleParsed} />;
}
