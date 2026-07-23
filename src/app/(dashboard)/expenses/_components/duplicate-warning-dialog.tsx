"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/utils";
import type { DuplicateMatch } from "@/lib/duplicate-check";

interface DuplicateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateMatch[];
  onConfirm: () => void;
  loading: boolean;
}

function formatDate(iso: string) {
  const [year, month, day] = iso.split("T")[0].split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DuplicateWarningDialog({
  open,
  onOpenChange,
  duplicates,
  onConfirm,
  loading,
}: DuplicateWarningDialogProps) {
  if (duplicates.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Possible duplicate</DialogTitle>
          <DialogDescription>
            {duplicates.length === 1
              ? `An expense for ${formatCurrency(duplicates[0].amount)} on ${formatDate(duplicates[0].date)} already exists${duplicates[0].where ? ` (${duplicates[0].where})` : ""}. Save anyway?`
              : "These existing expenses match the same date and amount. Save anyway?"}
          </DialogDescription>
        </DialogHeader>

        {duplicates.length > 1 && (
          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
            {duplicates.map((d, i) => (
              <li key={i}>
                {formatCurrency(d.amount)} on {formatDate(d.date)}
                {d.where ? ` (${d.where})` : ""}
              </li>
            ))}
          </ul>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={loading} aria-busy={loading}>
            {loading ? "Saving…" : "Save Anyway"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
