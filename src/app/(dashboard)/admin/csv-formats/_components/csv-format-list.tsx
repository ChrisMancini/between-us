"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SerializedCsvFormat } from "@/lib/models/csv-format";
import type { SerializedCategory } from "@/lib/models/category";
import { CsvFormatFormDialog } from "./csv-format-form-dialog";
import { DeleteCsvFormatDialog } from "./delete-csv-format-dialog";

interface CsvFormatListProps {
  formats: SerializedCsvFormat[];
  categories: SerializedCategory[];
}

export function CsvFormatList({ formats, categories }: CsvFormatListProps) {
  const [deleteTarget, setDeleteTarget] = useState<SerializedCsvFormat | null>(
    null
  );

  if (formats.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-primary/20 bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No CSV formats defined yet. Add one to get started.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-primary/10 overflow-hidden shadow-sm bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                Name
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                Amount Type
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                Mappings
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 w-24">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {formats.map((fmt) => (
              <tr
                key={fmt._id}
                className="hover:bg-muted/60 transition-colors"
              >
                <td className="px-4 py-2.5 font-medium">{fmt.name}</td>
                <td className="px-4 py-2.5">
                  <Badge variant="outline">
                    {fmt.amountType === "separate"
                      ? "Separate columns"
                      : "Single column"}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  {fmt.categoryMappings.length > 0
                    ? `${fmt.categoryMappings.length} category mapping${fmt.categoryMappings.length !== 1 ? "s" : ""}`
                    : "None"}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <CsvFormatFormDialog
                      format={fmt}
                      categories={categories}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="text-muted-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(fmt)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteTarget && (
        <DeleteCsvFormatDialog
          formatId={deleteTarget._id}
          formatName={deleteTarget.name}
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        />
      )}
    </>
  );
}
