"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { TagPicker } from "@/components/tag-picker";
import type { SerializedTag } from "@/lib/models/tag";
import type { BulkEditValues } from "@/types/bulk-expense";

type TagMode = "replace" | "add" | "remove";

interface BulkEditBarProps {
  selectedCount: number;
  tags: SerializedTag[];
  onApply: (values: BulkEditValues) => void;
  onDelete: () => void;
  onCancel: () => void;
}

const TAG_MODE_LABELS: Record<TagMode, string> = {
  replace: "Replace with",
  add: "Add",
  remove: "Remove",
};

export function BulkEditBar({ selectedCount, tags, onApply, onDelete, onCancel }: BulkEditBarProps) {
  const [tagMode, setTagMode] = useState<TagMode>("replace");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [splitType, setSplitType] = useState<string>("__none__");
  const [settlementType, setSettlementType] = useState<string>("__none__");

  const hasChanges =
    selectedTagIds.length > 0 || splitType !== "__none__" || settlementType !== "__none__";

  function handleApply() {
    const values: BulkEditValues = {};
    if (selectedTagIds.length > 0) {
      values.tags = { mode: tagMode, tagIds: selectedTagIds };
    }
    if (splitType === "split" || splitType === "full") {
      values.splitType = splitType;
    }
    if (settlementType === "immediate" || settlementType === "deferred") {
      values.settlementType = settlementType;
    }
    onApply(values);
  }

  return (
    <div className="sticky top-0 z-10 border-b border-primary/10 bg-muted/50 backdrop-blur-sm px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-primary/70">
          Bulk Edit
        </span>
        <Badge variant="secondary" className="text-xs">
          {selectedCount} selected
        </Badge>

        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Tags:</span>
          <Select value={tagMode} onValueChange={(v) => setTagMode((v as TagMode) ?? "replace")}>
            <SelectTrigger className="h-7 w-[150px] text-xs">
              <SelectValue>{TAG_MODE_LABELS[tagMode]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="replace" className="text-xs">Replace with</SelectItem>
              <SelectItem value="add" className="text-xs">Add to existing</SelectItem>
              <SelectItem value="remove" className="text-xs">Remove from existing</SelectItem>
            </SelectContent>
          </Select>
          <div className="w-48">
            <TagPicker
              tags={tags}
              selectedTagIds={selectedTagIds}
              onSelectedChange={setSelectedTagIds}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Split:</span>
          <Select value={splitType} onValueChange={(v) => setSplitType(v ?? "__none__")}>
            <SelectTrigger className="h-7 w-[110px] text-xs">
              <SelectValue>
                {splitType === "split" ? "50 / 50" : splitType === "full" ? "Full" : "No change"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" className="text-xs">No change</SelectItem>
              <SelectItem value="split" className="text-xs">50 / 50</SelectItem>
              <SelectItem value="full" className="text-xs">Full</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Settlement:</span>
          <Select value={settlementType} onValueChange={(v) => setSettlementType(v ?? "__none__")}>
            <SelectTrigger className="h-7 w-[120px] text-xs">
              <SelectValue>
                {settlementType === "deferred" ? "Deferred" : settlementType === "immediate" ? "Immediate" : "No change"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" className="text-xs">No change</SelectItem>
              <SelectItem value="deferred" className="text-xs">Deferred</SelectItem>
              <SelectItem value="immediate" className="text-xs">Immediate</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!hasChanges}
            onClick={handleApply}
          >
            Apply
          </Button>
          <div className="border-l border-border pl-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete
            </Button>
          </div>
          <div className="border-l border-border pl-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
