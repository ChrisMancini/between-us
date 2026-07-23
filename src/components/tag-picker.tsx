"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { X, Plus, Tags, ChevronDown, Link2 } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { collapseToMostSpecific } from "@/lib/tag-hierarchy";
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

  const pathById = useMemo(
    () => new Map(tags.map((t) => [t._id, t.path])),
    [tags]
  );

  // A tag that isn't selected but is an ancestor of a selected tag is still
  // considered associated with the expense — surface which descendant(s) imply it.
  const impliedByNames = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const tag of tags) {
      if (selectedTagIds.includes(tag._id)) continue;
      const causes = tags.filter(
        (t) => selectedTagIds.includes(t._id) && t.path.startsWith(`${tag.path}/`)
      );
      // Show the path relative to this tag (e.g. "June/Bills"), not just the
      // leaf name, so two descendants that share a leaf name stay distinct.
      if (causes.length > 0) {
        map.set(
          tag._id,
          causes.map((c) => c.path.slice(tag.path.length + 1))
        );
      }
    }
    return map;
  }, [tags, selectedTagIds]);

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
        // Selecting a tag implies its ancestors, so a parent and one of its
        // own descendants can never be selected at the same time.
        onSelectedChange(
          collapseToMostSpecific([...selectedTagIds, tagId], pathById)
        );
      }
    },
    [selectedTagIds, onSelectedChange, pathById]
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
        const nextPathById = new Map(pathById).set(data.tag._id, data.tag.path);
        onSelectedChange(
          collapseToMostSpecific([...selectedTagIds, data.tag._id], nextPathById)
        );
        setSearch("");
      }
    } finally {
      setCreating(false);
    }
  }, [canCreate, creating, search, selectedTagIds, onSelectedChange, onTagCreated, pathById]);

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
    <div>
      {/* Popover trigger */}
      <Popover open={open} onOpenChange={setOpen}>
        <div
          className={cn(
            "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors",
            "focus-within:ring-3 focus-within:ring-ring/50",
            error && "border-destructive"
          )}
        >
          <Tags
            className="h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          {selectedTags.map((tag) => (
            <Badge key={tag._id} variant="secondary" className="gap-1 pr-1">
              {tag.path}
              <button
                type="button"
                aria-label={`Remove ${tag.path}`}
                onClick={() => removeTag(tag._id)}
                className="focus-ring inline-flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
          <PopoverTrigger
            aria-label="Select tags"
            className={cn(
              "flex min-w-12 flex-1 items-center justify-between gap-1 rounded-sm text-left outline-none",
              selectedTags.length === 0 && "text-muted-foreground"
            )}
          >
            <span className="flex-1 truncate">
              {selectedTags.length === 0 ? "Select tags..." : ""}
            </span>
            <ChevronDown
              className="h-4 w-4 shrink-0 opacity-50"
              aria-hidden="true"
            />
          </PopoverTrigger>
        </div>
        <PopoverContent className="w-[320px] p-0" align="start">
          <div className="p-2 border-b">
            <Input
              ref={inputRef}
              aria-label="Search or create a tag"
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
              const impliedVia = impliedByNames.get(tag._id);
              const impliedViaLabel = impliedVia?.join(", ");
              return (
                <label
                  key={tag._id}
                  className={cn(
                    "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
                    impliedVia
                      ? "cursor-not-allowed"
                      : "cursor-pointer hover:bg-accent hover:text-accent-foreground",
                    checked && "bg-accent/50"
                  )}
                >
                  <Checkbox
                    checked={checked}
                    disabled={!!impliedVia}
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
                  {impliedViaLabel && (
                    <Tooltip>
                      <TooltipTrigger
                        render={
                          <span
                            className="inline-flex shrink-0 items-center"
                            tabIndex={0}
                            aria-label={`Included via ${impliedViaLabel}`}
                          />
                        }
                      >
                        <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>Included via {impliedViaLabel}</TooltipContent>
                    </Tooltip>
                  )}
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
