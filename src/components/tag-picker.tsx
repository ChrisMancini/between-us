"use client";

import { useState, useRef, useCallback } from "react";
import { X, Plus, Tags, ChevronDown } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { SerializedTag } from "@/lib/models/tag";

interface TagPickerProps {
  tags: SerializedTag[];
  selectedTagIds: string[];
  onSelectedChange: (ids: string[]) => void;
  onTagCreated?: (tag: SerializedTag) => void;
  error?: boolean;
}

export function TagPicker({
  tags,
  selectedTagIds,
  onSelectedChange,
  onTagCreated,
  error,
}: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedTags = tags.filter((t) => selectedTagIds.includes(t._id));

  const filteredTags = search.trim()
    ? tags.filter((t) =>
        t.path.toLowerCase().includes(search.toLowerCase())
      )
    : tags;

  const exactMatch = tags.find(
    (t) => t.path.toLowerCase() === search.trim().toLowerCase()
  );

  const canCreate =
    search.trim().length > 0 &&
    !exactMatch &&
    !search.trim().startsWith("/") &&
    !search.trim().endsWith("/");

  const toggleTag = useCallback(
    (tagId: string) => {
      if (selectedTagIds.includes(tagId)) {
        onSelectedChange(selectedTagIds.filter((id) => id !== tagId));
      } else {
        onSelectedChange([...selectedTagIds, tagId]);
      }
    },
    [selectedTagIds, onSelectedChange]
  );

  const removeTag = useCallback(
    (tagId: string) => {
      onSelectedChange(selectedTagIds.filter((id) => id !== tagId));
    },
    [selectedTagIds, onSelectedChange]
  );

  const createTag = useCallback(async () => {
    if (!canCreate || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/tags/create-inline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: search.trim() }),
      });
      const data = await res.json();
      if (data.tag) {
        onTagCreated?.(data.tag);
        onSelectedChange([...selectedTagIds, data.tag._id]);
        setSearch("");
      }
    } finally {
      setCreating(false);
    }
  }, [canCreate, creating, search, selectedTagIds, onSelectedChange, onTagCreated]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && canCreate) {
      e.preventDefault();
      createTag();
    }
  };

  // Group tags by parent for display
  const sortedTags = [...filteredTags].sort((a, b) =>
    a.path.localeCompare(b.path, undefined, { sensitivity: "base" })
  );

  return (
    <div className="space-y-1.5">
      {/* Selected tags as badges */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
            <Badge key={tag._id} variant="secondary" className="gap-1 pr-1">
              {tag.path}
              <button
                type="button"
                onClick={() => removeTag(tag._id)}
                className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Popover trigger */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            error && "border-destructive",
            selectedTags.length === 0 && "text-muted-foreground"
          )}
        >
          <span className="flex items-center gap-2">
            <Tags className="h-4 w-4" />
            {selectedTags.length === 0
              ? "Select tags..."
              : `${selectedTags.length} tag${selectedTags.length > 1 ? "s" : ""} selected`}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <div className="p-2 border-b">
            <Input
              ref={inputRef}
              placeholder="Search or type a new tag..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8"
            />
          </div>

          <div className="max-h-[240px] overflow-y-auto p-1">
            {sortedTags.length === 0 && !canCreate && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {search ? "No matching tags" : "No tags yet"}
              </p>
            )}

            {sortedTags.map((tag) => {
              const checked = selectedTagIds.includes(tag._id);
              return (
                <label
                  key={tag._id}
                  className={cn(
                    "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer",
                    "hover:bg-accent hover:text-accent-foreground",
                    checked && "bg-accent/50"
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleTag(tag._id)}
                  />
                  <span
                    className="flex-1 truncate"
                    style={{ paddingLeft: `${(tag.depth - 1) * 12}px` }}
                  >
                    {tag.depth > 1 && (
                      <span className="text-muted-foreground">
                        {tag.parent}/
                      </span>
                    )}
                    {tag.name}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Create new tag */}
          {canCreate && (
            <div className="border-t p-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-sm"
                disabled={creating}
                onClick={createTag}
              >
                <Plus className="h-4 w-4" />
                Create &quot;{search.trim()}&quot;
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
