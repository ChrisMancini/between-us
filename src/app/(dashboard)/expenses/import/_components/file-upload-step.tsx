"use client";

import { useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { FileSpreadsheet } from "lucide-react";
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
import type { SerializedCsvFormat } from "@/lib/models/csv-format";
import type { CsvParseResult } from "@/lib/csv-parsers/types";
import { parseCsv } from "@/lib/csv-parsers/parse";

interface FileUploadStepProps {
  formats: SerializedCsvFormat[];
  onParsed: (result: CsvParseResult, format: SerializedCsvFormat) => void;
}

export function FileUploadStep({ formats, onParsed }: FileUploadStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFormatId, setSelectedFormatId] = useState("");
  const [parsing, setParsing] = useState(false);

  function handleParse() {
    if (!selectedFormatId) {
      toast.error("Please select a CSV format");
      return;
    }

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Please select a CSV file");
      return;
    }

    const format = formats.find((f) => f._id === selectedFormatId);
    if (!format) return;

    setParsing(true);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        setParsing(false);

        if (results.data.length === 0) {
          toast.error("CSV file is empty");
          return;
        }

        // Validate that expected columns exist
        const headers = results.meta.fields ?? [];
        const missingColumns: string[] = [];

        if (!headers.includes(format.dateColumn)) {
          missingColumns.push(format.dateColumn);
        }
        if (!headers.includes(format.descriptionColumn)) {
          missingColumns.push(format.descriptionColumn);
        }
        if (format.amountType === "separate") {
          if (format.debitColumn && !headers.includes(format.debitColumn)) {
            missingColumns.push(format.debitColumn);
          }
          if (format.creditColumn && !headers.includes(format.creditColumn)) {
            missingColumns.push(format.creditColumn);
          }
        } else {
          if (format.amountColumn && !headers.includes(format.amountColumn)) {
            missingColumns.push(format.amountColumn);
          }
        }

        if (format.notesColumn && !headers.includes(format.notesColumn)) {
          missingColumns.push(format.notesColumn);
        }

        if (missingColumns.length > 0) {
          toast.error(
            `CSV is missing expected columns: ${missingColumns.join(", ")}. Check that the selected format matches this file.`
          );
          return;
        }

        const result = parseCsv(results.data, format);

        if (result.transactions.length === 0) {
          toast.error("No valid transactions found in CSV");
          return;
        }

        onParsed(result, format);
      },
      error(err) {
        setParsing(false);
        toast.error(`CSV parsing error: ${err.message}`);
      },
    });
  }

  if (formats.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-amber-500/30 bg-amber-50/60 dark:bg-amber-950/30 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No CSV formats have been defined yet. Ask an admin to create one in
          the Admin &rarr; CSV Formats section.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden">
      <div className="border-b border-primary/10 bg-primary/5 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
          Upload CSV
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select your card format and upload the CSV export from your credit
          card company.
        </p>
      </div>
      <div className="px-5 py-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg">
          <div className="space-y-1.5">
            <Label>Card Format</Label>
            <Select
              value={selectedFormatId}
              onValueChange={(v: string | null) => setSelectedFormatId(v ?? "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select format...">
                  {formats.find((f) => f._id === selectedFormatId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {formats.map((f) => (
                  <SelectItem key={f._id} value={f._id}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>CSV File</Label>
            <Input ref={fileInputRef} type="file" accept=".csv" />
          </div>
        </div>
        <div>
          <Button
            onClick={handleParse}
            disabled={parsing}
            className="gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            {parsing ? "Parsing…" : "Parse CSV"}
          </Button>
        </div>
      </div>
    </div>
  );
}
