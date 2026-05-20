"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X, Tags, ChevronDown, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { MonthNav } from "@/components/month-nav";
import { usePersons } from "@/components/persons-context";
import { cn } from "@/lib/utils";
import type { SerializedTag } from "@/lib/models/tag";

interface ExpenseFiltersProps {
  tags: SerializedTag[];
  filters: {
    q: string;
    tag: string;
    paidBy: string;
    month: number | null;
    year: number;
  };
}

export function ExpenseFilters({ tags, filters }: ExpenseFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { persons, personMap } = usePersons();
  const [searchValue, setSearchValue] = useState(filters.q);

  // Sync search input when URL changes externally
  useEffect(() => {
    setSearchValue(filters.q);
  }, [filters.q]);

  // Debounce search → URL
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchValue !== filters.q) {
        pushParams({ q: searchValue });
      }
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  function pushParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    router.push(`/expenses?${params.toString()}`);
  }

  const hasFilters =
    filters.q || filters.tag || filters.paidBy || filters.month === null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Search input */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search where..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-8 h-8"
        />
        {searchValue && (
          <button
            type="button"
            onClick={() => setSearchValue("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Tag filter */}
      <TagFilterCombobox
        tags={tags}
        value={filters.tag}
        onChange={(val) => pushParams({ tag: val || null })}
      />

      {/* Paid by filter */}
      <Select
        value={filters.paidBy || "__all__"}
        onValueChange={(val) =>
          pushParams({ paidBy: val === "__all__" ? null : val })
        }
      >
        <SelectTrigger className="w-[120px] h-8">
          <SelectValue>
            {filters.paidBy
              ? personMap.get(filters.paidBy)?.displayName ?? filters.paidBy
              : "Everyone"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Everyone</SelectItem>
          {persons.map((p) => (
            <SelectItem key={p.key} value={p.key}>
              {p.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Month navigation */}
      <div className="flex items-center gap-2 ml-auto">
        {filters.month !== null ? (
          <>
            <MonthNav
              month={filters.month}
              year={filters.year}
              basePath="/expenses"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => pushParams({ month: "all", year: null })}
            >
              All
            </Button>
          </>
        ) : (
          <>
            <span className="text-sm font-semibold text-foreground">
              All Months
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                const now = new Date();
                pushParams({
                  month: String(now.getMonth() + 1),
                  year: String(now.getFullYear()),
                });
              }}
            >
              Current
            </Button>
          </>
        )}
      </div>

      {/* Reset all */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={() => router.push("/expenses")}
        >
          Reset
        </Button>
      )}
    </div>
  );
}

function TagFilterCombobox({
  tags,
  value,
  onChange,
}: {
  tags: SerializedTag[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = search.trim()
    ? tags.filter((t) =>
        t.path.toLowerCase().includes(search.toLowerCase())
      )
    : tags;

  const sorted = [...filtered].sort((a, b) =>
    a.path.localeCompare(b.path, undefined, { sensitivity: "base" })
  );

  function select(tagPath: string) {
    onChange(value === tagPath ? "" : tagPath);
    setOpen(false);
    setSearch("");
    setHighlightIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => {
        const next = Math.min(i + 1, sorted.length - 1);
        scrollToIndex(next);
        return next;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => {
        const next = Math.max(i - 1, 0);
        scrollToIndex(next);
        return next;
      });
    } else if (e.key === "Enter" && highlightIndex >= 0 && highlightIndex < sorted.length) {
      e.preventDefault();
      select(sorted[highlightIndex].path);
    } else if (e.key === "Escape") {
      setOpen(false);
      setSearch("");
      setHighlightIndex(-1);
    }
  }

  function scrollToIndex(index: number) {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[index] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSearch("");
          setHighlightIndex(-1);
        }
      }}
    >
      <div className="relative flex items-center">
        <PopoverTrigger
          className={cn(
            "flex h-8 w-[150px] items-center justify-between rounded-md border border-input bg-transparent px-2.5 text-sm transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            value && "pr-7",
            !value && "text-muted-foreground"
          )}
        >
          <span className="flex items-center gap-1.5 truncate">
            <Tags className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{value || "All tags"}</span>
          </span>
          {!value && (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          )}
        </PopoverTrigger>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-1.5 shrink-0 rounded-full hover:bg-foreground/10 p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <PopoverContent className="w-[240px] p-0" align="start">
        <div className="p-2 border-b">
          <Input
            ref={inputRef}
            placeholder="Search tags..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setHighlightIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="h-8"
          />
        </div>
        <div ref={listRef} className="max-h-[240px] overflow-y-auto p-1">
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No matching tags
            </p>
          )}
          {sorted.map((tag, index) => {
            const isSelected = value === tag.path;
            const isHighlighted = index === highlightIndex;
            return (
              <button
                key={tag._id}
                type="button"
                onClick={() => select(tag.path)}
                onMouseEnter={() => setHighlightIndex(index)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left cursor-pointer",
                  "hover:bg-accent hover:text-accent-foreground",
                  isHighlighted && "bg-accent text-accent-foreground",
                  isSelected && !isHighlighted && "bg-accent/50"
                )}
              >
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
                {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
