"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface TagsStepProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}

export function TagsStep({ tags: starterTags, onTagsChange }: TagsStepProps) {
  const [newTag, setNewTag] = useState("");

  function addTag() {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    if (
      starterTags.some(
        (t) => t.toLowerCase() === trimmed.toLowerCase()
      )
    )
      return;
    onTagsChange([...starterTags, trimmed]);
    setNewTag("");
  }

  function removeTag(tag: string) {
    onTagsChange(starterTags.filter((t) => t !== tag));
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-lg font-semibold">Tags</h2>
        <p className="text-sm text-muted-foreground">
          Tags are flexible labels for organizing your expenses. You can create
          them now or add them later from the expense form or
          Admin&nbsp;&rarr;&nbsp;Tags.
        </p>
      </div>

      <div className="rounded-xl border border-primary/10 bg-card overflow-hidden p-5 space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">How tags work</Label>
          <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-4">
            <li>
              Use <code className="text-xs bg-muted px-1 py-0.5 rounded">/</code>{" "}
              to create nested tags (e.g., &quot;Vacation/Italy 2026&quot;)
            </li>
            <li>Tags are case-insensitive</li>
            <li>Each expense can have multiple tags</li>
            <li>
              Settlement type (immediate vs. deferred) is set per expense, not
              per tag
            </li>
          </ul>
        </div>

        <div className="border-t border-border pt-4 space-y-3">
          <Label className="text-sm font-medium">
            Starter tags{" "}
            <span className="text-muted-foreground font-normal">
              (optional)
            </span>
          </Label>

          {starterTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {starterTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="e.g. Groceries, Bills, Vacation/Italy 2026"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={addTag}
              disabled={!newTag.trim()}
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        You can always create, rename, or reorganize tags later. Tags can be
        added on the fly when entering expenses.
      </p>
    </div>
  );
}
