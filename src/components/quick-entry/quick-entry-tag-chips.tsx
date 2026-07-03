"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TagPicker } from "@/components/tag-picker";
import type { SerializedTag } from "@/lib/models/tag";

interface QuickEntryTagChipsProps {
  tags: SerializedTag[];
  recentTagIds: string[];
  selectedTagIds: string[];
  onSelectedChange: (ids: string[]) => void;
  onTagCreated: (tag: SerializedTag) => void;
}

export function QuickEntryTagChips({
  tags,
  recentTagIds,
  selectedTagIds,
  onSelectedChange,
  onTagCreated,
}: QuickEntryTagChipsProps) {
  const recentTags = recentTagIds
    .map((id) => tags.find((t) => t._id === id))
    .filter((t): t is SerializedTag => t != null);

  const chipTags = recentTags.length > 0 ? recentTags : tags.slice(0, 5);

  const nonChipSelected = selectedTagIds
    .filter((id) => !chipTags.some((t) => t._id === id))
    .map((id) => tags.find((t) => t._id === id))
    .filter((t): t is SerializedTag => t != null);

  function toggleTag(tagId: string) {
    if (selectedTagIds.includes(tagId)) {
      onSelectedChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onSelectedChange([...selectedTagIds, tagId]);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {chipTags.map((tag) => {
          const selected = selectedTagIds.includes(tag._id);
          return (
            <button
              key={tag._id}
              type="button"
              onClick={() => toggleTag(tag._id)}
            >
              <Badge
                variant={selected ? "default" : "outline"}
                className={selected ? undefined : "border-dashed text-muted-foreground"}
              >
                {tag.path}
              </Badge>
            </button>
          );
        })}
      </div>

      {nonChipSelected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {nonChipSelected.map((tag) => (
            <button
              key={tag._id}
              type="button"
              onClick={() => toggleTag(tag._id)}
            >
              <Badge variant="secondary" className="gap-1 pr-1">
                {tag.path}
                <X className="h-3 w-3" />
              </Badge>
            </button>
          ))}
        </div>
      )}

      <TagPicker
        tags={tags}
        selectedTagIds={selectedTagIds}
        onSelectedChange={onSelectedChange}
        onTagCreated={onTagCreated}
      />
    </div>
  );
}
