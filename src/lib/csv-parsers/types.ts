export interface ParsedTransaction {
  date: string;
  description: string;
  amountCents: number;
  originalRow: number;
  sourceTag?: string;
  mappedTagIds?: string[];
  notes?: string;
}

export interface SkippedRow {
  row: number;
  description: string;
  reason: string;
}

export interface ParseError {
  row: number;
  message: string;
}

export interface CsvParseResult {
  transactions: ParsedTransaction[];
  skipped: SkippedRow[];
  errors: ParseError[];
}
