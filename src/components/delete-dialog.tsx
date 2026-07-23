"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  endpoint: string;
  itemType: string;
  itemLabel: string;
  description?: string;
}

export function DeleteDialog({
  open,
  onOpenChange,
  endpoint,
  itemType,
  itemLabel,
  description,
}: DeleteDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? `Failed to delete ${itemType}`);
        return;
      }

      toast.success(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} deleted`);
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {itemType}?</DialogTitle>
          <DialogDescription>
            {description ?? (
              <>
                Are you sure you want to delete{" "}
                <strong>{itemLabel}</strong>? This action cannot be undone.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
