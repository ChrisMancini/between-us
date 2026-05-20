import type { SerializedCsvFormat } from "@/lib/models/csv-format";
import type { CsvParseResult, ParsedTransaction, SkippedRow, ParseError } from "./types";

const DATE_PARSERS: Record<string, (value: string) => Date | null> = {
  "MM/DD/YYYY": (v) => {
    const [m, d, y] = v.split("/");
    if (!m || !d || !y) return null;
    const date = new Date(Date.UTC(+y, +m - 1, +d));
    return isNaN(date.getTime()) ? null : date;
  },
  "YYYY-MM-DD": (v) => {
    const [y, m, d] = v.split("-");
    if (!y || !m || !d) return null;
    const date = new Date(Date.UTC(+y, +m - 1, +d));
    return isNaN(date.getTime()) ? null : date;
  },
  "MM-DD-YYYY": (v) => {
    const [m, d, y] = v.split("-");
    if (!m || !d || !y) return null;
    const date = new Date(Date.UTC(+y, +m - 1, +d));
    return isNaN(date.getTime()) ? null : date;
  },
  "DD/MM/YYYY": (v) => {
    const [d, m, y] = v.split("/");
    if (!d || !m || !y) return null;
    const date = new Date(Date.UTC(+y, +m - 1, +d));
    return isNaN(date.getTime()) ? null : date;
  },
};

function cleanDescription(raw: string): string {
  let cleaned = raw.trim();
  // Remove trailing card number patterns like "null XXXXXXXXXXXX2268" or "XXXXXXXXXXXX3550"
  cleaned = cleaned.replace(/\s*null\s+X{4,}\d+\s*$/i, "");
  cleaned = cleaned.replace(/\s+X{4,}\d+\s*$/i, "");
  // Truncate to 100 chars (the where field max length)
  if (cleaned.length > 100) {
    cleaned = cleaned.substring(0, 100);
  }
  return cleaned || raw.trim().substring(0, 100);
}

export function parseCsv(
  rows: Record<string, string>[],
  format: SerializedCsvFormat
): CsvParseResult {
  const transactions: ParsedTransaction[] = [];
  const skipped: SkippedRow[] = [];
  const errors: ParseError[] = [];

  const parseDate = DATE_PARSERS[format.dateFormat];
  if (!parseDate) {
    errors.push({ row: 0, message: `Unsupported date format: ${format.dateFormat}` });
    return { transactions, skipped, errors };
  }

  const tagMap = new Map(
    (format.tagMappings || []).map((m) => [
      m.sourceValue.toLowerCase(),
      m.tagIds,
    ])
  );

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // +2: 1-indexed + header row

    // Parse date
    const rawDate = row[format.dateColumn]?.trim();
    if (!rawDate) {
      errors.push({ row: rowNum, message: `Missing date column "${format.dateColumn}"` });
      continue;
    }
    const date = parseDate(rawDate);
    if (!date) {
      errors.push({ row: rowNum, message: `Invalid date: "${rawDate}"` });
      continue;
    }

    // Parse description
    const rawDesc = row[format.descriptionColumn]?.trim() ?? "";
    const description = cleanDescription(rawDesc);

    // Parse amount based on type
    let amountCents: number;

    if (format.amountType === "separate") {
      const creditVal = row[format.creditColumn ?? ""]?.trim();
      if (creditVal && creditVal !== "" && creditVal !== "0" && creditVal !== "0.00") {
        skipped.push({ row: rowNum, description, reason: "Payment/credit" });
        continue;
      }

      const debitVal = row[format.debitColumn ?? ""]?.trim();
      if (!debitVal || debitVal === "") {
        skipped.push({ row: rowNum, description, reason: "No debit amount" });
        continue;
      }

      const debitNum = parseFloat(debitVal);
      if (isNaN(debitNum) || debitNum <= 0) {
        skipped.push({ row: rowNum, description, reason: "Zero or invalid amount" });
        continue;
      }

      amountCents = Math.round(debitNum * 100);
    } else {
      // single column
      const amtVal = row[format.amountColumn ?? ""]?.trim();
      if (!amtVal || amtVal === "") {
        errors.push({ row: rowNum, message: "Missing amount" });
        continue;
      }

      const amtNum = parseFloat(amtVal);
      if (isNaN(amtNum) || amtNum === 0) {
        skipped.push({ row: rowNum, description, reason: "Zero or invalid amount" });
        continue;
      }

      // Check if this is a purchase based on the sign
      const isPurchase =
        format.purchaseSign === "negative" ? amtNum < 0 : amtNum > 0;

      if (!isPurchase) {
        skipped.push({ row: rowNum, description, reason: "Payment/credit" });
        continue;
      }

      amountCents = Math.round(Math.abs(amtNum) * 100);
    }

    if (amountCents < 1) {
      skipped.push({ row: rowNum, description, reason: "Zero amount" });
      continue;
    }

    // Tag mapping
    let sourceTag: string | undefined;
    let mappedTagIds: string[] | undefined;

    if (format.tagColumn) {
      sourceTag = row[format.tagColumn]?.trim();
      if (sourceTag) {
        mappedTagIds = tagMap.get(sourceTag.toLowerCase());
      }
    }

    // Notes extraction
    let notes: string | undefined;
    if (format.notesColumn) {
      const rawNotes = row[format.notesColumn]?.trim();
      if (rawNotes) {
        notes = rawNotes.substring(0, 500);
      }
    }

    const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD

    transactions.push({
      date: dateStr,
      description,
      amountCents,
      originalRow: rowNum,
      sourceTag,
      mappedTagIds,
      notes,
    });
  }

  return { transactions, skipped, errors };
}
