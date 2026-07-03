export interface BulkEditValues {
  tags?: { mode: "replace" | "add" | "remove"; tagIds: string[] };
  splitType?: "split" | "full";
  settlementType?: "immediate" | "deferred";
}

export interface BulkEditResult {
  expenseId: string;
  status: "updated" | "skipped";
  reason?: string;
  changedFields?: string[];
}

export interface BulkEditResponse {
  results: BulkEditResult[];
  summary: { updated: number; skipped: number };
}

export interface BulkDeleteResult {
  expenseId: string;
  status: "deleted" | "skipped";
  reason?: string;
}

export interface BulkDeleteResponse {
  results: BulkDeleteResult[];
  summary: { deleted: number; skipped: number };
}
