import type { SkipReason } from "@/lib/recurring-apply-core";

/**
 * The apply-run summary shown in an activity entry's popover, parsed from the
 * consolidated metadata written by `applyTemplateCore`. Pure and defensive: older
 * entries (or a hand-edited document) may be missing fields, so every field falls
 * back to a safe default rather than throwing in the render path.
 */
export interface ApplySummary {
  templateName: string;
  /** Occurrence date as stored, "YYYY-MM-DD"; empty when absent. */
  date: string;
  /** Number of expenses the run created. */
  addedCount: number;
  /** `where` labels of items skipped as duplicates of a manual entry. */
  duplicates: string[];
  /** `where` labels of items skipped because a tag was deleted. */
  flagged: string[];
}

function isSkipEntry(
  value: unknown
): value is { where?: unknown; reason?: SkipReason } {
  return typeof value === "object" && value !== null && "reason" in value;
}

/** Build the popover summary from an apply activity's metadata. */
export function parseApplySummary(
  metadata: Record<string, unknown>
): ApplySummary {
  const rawSkipped = Array.isArray(metadata.skipped) ? metadata.skipped : [];
  const duplicates: string[] = [];
  const flagged: string[] = [];
  for (const entry of rawSkipped) {
    if (!isSkipEntry(entry)) continue;
    const where = typeof entry.where === "string" ? entry.where : "";
    if (entry.reason === "deleted_tag") flagged.push(where);
    else duplicates.push(where);
  }

  return {
    templateName:
      typeof metadata.templateName === "string"
        ? metadata.templateName
        : "Template",
    date: typeof metadata.date === "string" ? metadata.date : "",
    addedCount: typeof metadata.count === "number" ? metadata.count : 0,
    duplicates,
    flagged,
  };
}
