"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronUp, ChevronDown, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SerializedCategory } from "@/lib/models/category";
import { CategoryFormDialog } from "./category-form-dialog";
import { DeleteCategoryDialog } from "./delete-category-dialog";

interface CategoryListProps {
  categories: SerializedCategory[];
}

export function CategoryList({ categories }: CategoryListProps) {
  const router = useRouter();
  const [reordering, setReordering] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SerializedCategory | null>(
    null
  );

  if (categories.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-primary/20 bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No categories yet. Add one to get started.
        </p>
      </div>
    );
  }

  async function handleReorder(fromIndex: number, direction: "up" | "down") {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= categories.length) return;

    const ids = categories.map((c) => c._id);
    // Swap
    [ids[fromIndex], ids[toIndex]] = [ids[toIndex], ids[fromIndex]];

    setReordering(true);
    try {
      const res = await fetch("/api/categories/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: ids }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to reorder");
        router.refresh();
        return;
      }

      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setReordering(false);
    }
  }

  return (
    <>
      <div className="rounded-xl border border-primary/10 overflow-hidden shadow-sm bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 w-12">
                #
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                Name
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                Settlement
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 w-40">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {categories.map((cat, index) => (
              <tr
                key={cat._id}
                className="hover:bg-muted/60 transition-colors"
              >
                <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                  {cat.sortOrder}
                </td>
                <td className="px-4 py-2.5 font-medium">{cat.name}</td>
                <td className="px-4 py-2.5">
                  <Badge
                    variant={
                      cat.settlementType === "immediate"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {cat.settlementType === "immediate"
                      ? "Immediate"
                      : "Deferred"}
                  </Badge>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      disabled={index === 0 || reordering}
                      onClick={() => handleReorder(index, "up")}
                      className="text-muted-foreground"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      disabled={
                        index === categories.length - 1 || reordering
                      }
                      onClick={() => handleReorder(index, "down")}
                      className="text-muted-foreground"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <CategoryFormDialog
                      category={cat}
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
                      onClick={() => setDeleteTarget(cat)}
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
        <DeleteCategoryDialog
          categoryId={deleteTarget._id}
          categoryName={deleteTarget.name}
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        />
      )}
    </>
  );
}
