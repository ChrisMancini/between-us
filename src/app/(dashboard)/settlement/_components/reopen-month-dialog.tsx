"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ReopenMonthDialogProps {
  month: number;
  year: number;
  monthLabel: string;
}

export function ReopenMonthDialog({
  month,
  year,
  monthLabel,
}: ReopenMonthDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleReopen() {
    setLoading(true);
    try {
      const res = await fetch("/api/settlement/reopen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to reopen month");
        return;
      }

      toast.success(`${monthLabel} reopened`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="gap-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5" />
        }
      >
        <LockOpen className="h-4 w-4" />
        Reopen Month
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reopen {monthLabel}?</DialogTitle>
          <DialogDescription className="pt-1">
            This will unlock the month so you can add or edit expenses. You
            can close it again when you&apos;re done.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/50 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          The previous settlement amount will be preserved so the re-close
          dialog can show you exactly what changed.
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleReopen} disabled={loading} variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/5"
          >
            {loading ? "Reopening…" : "Reopen Month"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
