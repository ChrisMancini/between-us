"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Upload, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SerializedCategory } from "@/lib/models/category";
import type { SkippedRow } from "@/lib/csv-parsers/types";

export interface ImportRow {
  id: string;
  date: string;
  originalDescription: string;
  where: string;
  notes: string;
  amountCents: number;
  originalRow: number;
  categoryId: string;
  sourceCategory?: string;
  splitType: "split" | "full";
  selected: boolean;
  isDuplicate: boolean;
  duplicateWhere?: string;
}

interface PreviewTableProps {
  rows: ImportRow[];
  skippedRows: SkippedRow[];
  categories: SerializedCategory[];
  importing: boolean;
  onRowsChange: (rows: ImportRow[]) => void;
  onImport: () => void;
  onBack: () => void;
}

export function PreviewTable({
  rows,
  skippedRows,
  categories,
  importing,
  onRowsChange,
  onImport,
  onBack,
}: PreviewTableProps) {
  const [skippedOpen, setSkippedOpen] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkSplitType, setBulkSplitType] = useState("");

  const selectedRows = rows.filter((r) => r.selected);
  const selectedCount = selectedRows.length;
  const totalCents = selectedRows.reduce((s, r) => s + r.amountCents, 0);
  const duplicateCount = rows.filter((r) => r.isDuplicate).length;

  const dates = rows.map((r) => new Date(r.date + "T00:00:00Z").getTime());
  const minDate =
    dates.length > 0
      ? new Date(Math.min(...dates)).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        })
      : "";
  const maxDate =
    dates.length > 0
      ? new Date(Math.max(...dates)).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        })
      : "";

  function updateRow(id: string, patch: Partial<ImportRow>) {
    onRowsChange(
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  }

  function handleSelectAll() {
    onRowsChange(rows.map((r) => ({ ...r, selected: true })));
  }

  function handleDeselectAll() {
    onRowsChange(rows.map((r) => ({ ...r, selected: false })));
  }

  function handleBulkCategory(categoryId: string) {
    onRowsChange(
      rows.map((r) => (r.selected ? { ...r, categoryId } : r))
    );
  }

  function handleBulkSplit(splitType: "split" | "full") {
    onRowsChange(
      rows.map((r) => (r.selected ? { ...r, splitType } : r))
    );
  }

  function handleImportClick() {
    const invalid = rows.filter((r) => r.selected && !r.categoryId);
    if (invalid.length > 0) {
      toast.error(
        `${invalid.length} selected row${invalid.length !== 1 ? "s" : ""} missing a category`
      );
      return;
    }
    if (selectedCount === 0) {
      toast.error("No rows selected for import");
      return;
    }
    onImport();
  }

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden">
        <div className="border-b border-primary/10 bg-primary/5 px-5 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
            Preview
          </p>
        </div>
        <div className="px-5 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Selected</p>
              <p className="text-lg font-semibold tabular-nums text-green-700 dark:text-green-400">
                {selectedCount} of {rows.length}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Skipped</p>
              <p className="text-lg font-semibold tabular-nums text-muted-foreground">
                {skippedRows.length}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Date Range</p>
              <p className="text-sm font-medium">
                {minDate} &mdash; {maxDate}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Selected Total</p>
              <p className="text-lg font-semibold tabular-nums">
                {formatCurrency(totalCents)}
              </p>
            </div>
          </div>
          {duplicateCount > 0 && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
              {duplicateCount} possible duplicate{duplicateCount !== 1 ? "s" : ""}{" "}
              detected and deselected.
            </p>
          )}
        </div>
      </div>

      {/* Skipped rows */}
      {skippedRows.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <button
            type="button"
            className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-muted/60 transition-colors"
            onClick={() => setSkippedOpen(!skippedOpen)}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {skippedRows.length} row{skippedRows.length !== 1 ? "s" : ""}{" "}
                skipped (payments, credits, zero amounts)
              </p>
            </div>
            {skippedOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          {skippedOpen && (
            <div className="border-t border-border px-5 py-3 max-h-48 overflow-y-auto">
              <ul className="text-xs text-muted-foreground space-y-0.5">
                {skippedRows.map((s, i) => (
                  <li key={i}>
                    Row {s.row}: {s.description || "(empty)"} &mdash;{" "}
                    {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Bulk actions */}
      <div className="flex flex-wrap items-center gap-3 px-1">
        <Button variant="outline" size="sm" onClick={handleSelectAll}>
          Select All
        </Button>
        <Button variant="outline" size="sm" onClick={handleDeselectAll}>
          Deselect All
        </Button>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">
            Set Category:
          </Label>
          <Select
            value={bulkCategoryId}
            onValueChange={(v: string | null) => { if (v) { handleBulkCategory(v); setBulkCategoryId(v); } }}
          >
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Apply to selected">
                {categories.find((c) => c._id === bulkCategoryId)?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat._id} value={cat._id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">
            Set Split:
          </Label>
          <Select
            value={bulkSplitType}
            onValueChange={(v: string | null) => { if (v) { handleBulkSplit(v as "split" | "full"); setBulkSplitType(v); } }}
          >
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue placeholder="Apply...">
                {bulkSplitType === "split"
                  ? "50/50"
                  : bulkSplitType === "full"
                    ? "Full"
                    : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="split">50/50</SelectItem>
              <SelectItem value="full">Full</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2.5 w-10" />
                <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 whitespace-nowrap">
                  Date
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                  Merchant / Location
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 w-32">
                  Notes
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 w-36">
                  Category
                </th>
                <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 w-16">
                  50/50
                </th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 w-24">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "transition-colors",
                    row.isDuplicate && "bg-amber-50/60 dark:bg-amber-950/40",
                    !row.selected && "opacity-50",
                    row.selected && !row.isDuplicate && "hover:bg-muted/60"
                  )}
                >
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={row.selected}
                      onCheckedChange={(checked) =>
                        updateRow(row.id, { selected: !!checked })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {new Date(row.date + "T00:00:00Z").toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        timeZone: "UTC",
                      }
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-0.5">
                      <Input
                        value={row.where}
                        onChange={(e) =>
                          updateRow(row.id, { where: e.target.value })
                        }
                        className="h-7 text-xs border-transparent hover:border-input focus:border-input bg-transparent"
                      />
                      {row.isDuplicate && (
                        <p className="text-[10px] text-amber-700 dark:text-amber-400 px-2">
                          Possible duplicate
                          {row.duplicateWhere
                            ? ` of "${row.duplicateWhere}"`
                            : ""}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={row.notes}
                      onChange={(e) =>
                        updateRow(row.id, { notes: e.target.value })
                      }
                      className="h-7 text-xs border-transparent hover:border-input focus:border-input bg-transparent"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="space-y-0.5">
                      <Select
                        value={row.categoryId}
                        onValueChange={(v: string | null) =>
                          updateRow(row.id, { categoryId: v ?? "" })
                        }
                      >
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Select...">
                            {categories.find((c) => c._id === row.categoryId)?.name}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat._id} value={cat._id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {row.sourceCategory && (
                        <p className="text-[10px] text-muted-foreground px-2 truncate">
                          CSV: {row.sourceCategory}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Checkbox
                      checked={row.splitType === "split"}
                      onCheckedChange={(checked) =>
                        updateRow(row.id, {
                          splitType: checked ? "split" : "full",
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {formatCurrency(row.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onBack} disabled={importing}>
          Back
        </Button>
        <Button
          onClick={handleImportClick}
          disabled={importing || selectedCount === 0}
          className="gap-2"
        >
          <Upload className="h-4 w-4" />
          {importing
            ? "Importing…"
            : `Import ${selectedCount} Expense${selectedCount !== 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
}
