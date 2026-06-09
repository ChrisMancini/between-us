import type { SerializedCsvFormat } from "@/lib/models/csv-format";
import type { CsvParseResult, ParsedTransaction, SkippedRow, ParseError } from "./types";

type AmountResult =
  | { ok: true; cents: number }
  | { ok: false; skip: string }
  | { ok: false; error: string };

function makeDateParser(
  separator: string,
  order: [number, number, number]
): (v: string) => Date | null {
  return (v) => {
    const parts = v.split(separator);
    if (parts.length < 3) return null;
    const date = new Date(
      Date.UTC(+parts[order[0]], +parts[order[1]] - 1, +parts[order[2]])
    );
    return isNaN(date.getTime()) ? null : date;
  };
}

const DATE_PARSERS: Record<string, (value: string) => Date | null> = {
  "MM/DD/YYYY": makeDateParser("/", [2, 0, 1]),
  "YYYY-MM-DD": makeDateParser("-", [0, 1, 2]),
  "MM-DD-YYYY": makeDateParser("-", [2, 0, 1]),
  "DD/MM/YYYY": makeDateParser("/", [2, 1, 0]),
};

function cleanDescription(raw: string): string {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/\s*null\s+X{4,}\d+\s*$/i, "");
  cleaned = cleaned.replace(/\s+X{4,}\d+\s*$/i, "");
  if (cleaned.length > 100) {
    cleaned = cleaned.substring(0, 100);
  }
  return cleaned || raw.trim().substring(0, 100);
}

function parseRowDate(
  row: Record<string, string>,
  dateColumn: string,
  parseDate: (v: string) => Date | null
): { date: Date } | { error: string } {
  const rawDate = row[dateColumn]?.trim();
  if (!rawDate) {
    return { error: `Missing date column "${dateColumn}"` };
  }
  const date = parseDate(rawDate);
  if (!date) {
    return { error: `Invalid date: "${rawDate}"` };
  }
  return { date };
}

function parseSeparateAmount(
  row: Record<string, string>,
  format: SerializedCsvFormat
): AmountResult {
  const creditVal = row[format.creditColumn ?? ""]?.trim();
  if (creditVal && creditVal !== "" && creditVal !== "0" && creditVal !== "0.00") {
    return { ok: false, skip: "Payment/credit" };
  }

  const debitVal = row[format.debitColumn ?? ""]?.trim();
  if (!debitVal || debitVal === "") {
    return { ok: false, skip: "No debit amount" };
  }

  const debitNum = parseFloat(debitVal);
  if (isNaN(debitNum) || debitNum <= 0) {
    return { ok: false, skip: "Zero or invalid amount" };
  }

  return { ok: true, cents: Math.round(debitNum * 100) };
}

function parseSingleAmount(
  row: Record<string, string>,
  format: SerializedCsvFormat
): AmountResult {
  const amtVal = row[format.amountColumn ?? ""]?.trim();
  if (!amtVal || amtVal === "") {
    return { ok: false, error: "Missing amount" };
  }

  const amtNum = parseFloat(amtVal);
  if (isNaN(amtNum) || amtNum === 0) {
    return { ok: false, skip: "Zero or invalid amount" };
  }

  const isPurchase =
    format.purchaseSign === "negative" ? amtNum < 0 : amtNum > 0;

  if (!isPurchase) {
    return { ok: false, skip: "Payment/credit" };
  }

  return { ok: true, cents: Math.round(Math.abs(amtNum) * 100) };
}

function parseRowAmount(
  row: Record<string, string>,
  format: SerializedCsvFormat
): AmountResult {
  const result =
    format.amountType === "separate"
      ? parseSeparateAmount(row, format)
      : parseSingleAmount(row, format);

  if (result.ok && result.cents < 1) {
    return { ok: false, skip: "Zero amount" };
  }

  return result;
}

type RowResult =
  | { kind: "transaction"; value: ParsedTransaction }
  | { kind: "skipped"; value: SkippedRow }
  | { kind: "error"; value: ParseError };

function parseRow(
  row: Record<string, string>,
  rowNum: number,
  format: SerializedCsvFormat,
  parseDate: (v: string) => Date | null,
  tagMap: Map<string, string[]>
): RowResult {
  const dateResult = parseRowDate(row, format.dateColumn, parseDate);
  if ("error" in dateResult) {
    return { kind: "error", value: { row: rowNum, message: dateResult.error } };
  }

  const description = cleanDescription(row[format.descriptionColumn]?.trim() ?? "");

  const amountResult = parseRowAmount(row, format);
  if (!amountResult.ok) {
    if ("error" in amountResult) {
      return { kind: "error", value: { row: rowNum, message: amountResult.error } };
    }
    return { kind: "skipped", value: { row: rowNum, description, reason: amountResult.skip } };
  }

  let sourceTag: string | undefined;
  let mappedTagIds: string[] | undefined;

  if (format.tagColumn) {
    sourceTag = row[format.tagColumn]?.trim();
    if (sourceTag) {
      mappedTagIds = tagMap.get(sourceTag.toLowerCase());
    }
  }

  let notes: string | undefined;
  if (format.notesColumn) {
    const rawNotes = row[format.notesColumn]?.trim();
    if (rawNotes) {
      notes = rawNotes.substring(0, 500);
    }
  }

  return {
    kind: "transaction",
    value: {
      date: dateResult.date.toISOString().split("T")[0],
      description,
      amountCents: amountResult.cents,
      originalRow: rowNum,
      sourceTag,
      mappedTagIds,
      notes,
    },
  };
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
    const result = parseRow(rows[i], i + 2, format, parseDate, tagMap);
    switch (result.kind) {
      case "transaction": transactions.push(result.value); break;
      case "skipped": skipped.push(result.value); break;
      case "error": errors.push(result.value); break;
    }
  }

  return { transactions, skipped, errors };
}
