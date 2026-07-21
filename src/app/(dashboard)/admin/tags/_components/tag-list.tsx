"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SerializedTag } from "@/lib/models/tag";
import { TagFormDialog } from "./tag-form-dialog";
import { DeleteDialog } from "@/components/delete-dialog";

interface TagListProps {
  tags: SerializedTag[];
}

export function TagList({ tags }: TagListProps) {
  const [deleteTarget, setDeleteTarget] = useState<SerializedTag | null>(null);

  const sorted = [...tags].sort((a, b) =>
    a.path.localeCompare(b.path, undefined, { sensitivity: "base" })
  );

  if (tags.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-primary/20 bg-card py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No tags yet. Add one to get started.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-primary/10 overflow-hidden shadow-sm bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
                Tag
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 w-24">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((tag) => (
              <tr
                key={tag._id}
                className="hover:bg-muted/60 transition-colors"
              >
                <td className="px-4 py-2.5 font-medium">
                  <span style={{ paddingLeft: `${(tag.depth - 1) * 1.25}rem` }}>
                    {tag.depth > 1 && (
                      <span className="text-muted-foreground/50">
                        {tag.parent}/
                      </span>
                    )}
                    {tag.name}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    <TagFormDialog
                      tag={tag}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="size-11 sm:size-6 text-muted-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-11 sm:size-6 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(tag)}
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
        <DeleteDialog
          endpoint={`/api/tags/${deleteTarget._id}`}
          itemType="tag"
          itemLabel={deleteTarget.path}
          description={`Are you sure you want to delete "${deleteTarget.path}"? This action cannot be undone. Deletion will fail if any expenses or recurring templates reference this tag.`}
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        />
      )}
    </>
  );
}
