"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MonthNav } from "@/components/month-nav";
import { usePersons } from "@/components/persons-context";
import type { SerializedCategory } from "@/lib/models/category";

interface ExpenseFiltersProps {
  categories: SerializedCategory[];
  filters: {
    q: string;
    category: string;
    paidBy: string;
    month: number | null;
    year: number;
  };
}

export function ExpenseFilters({ categories, filters }: ExpenseFiltersProps) {
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
    filters.q || filters.category || filters.paidBy || filters.month === null;

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

      {/* Category filter */}
      <Select
        value={filters.category || "__all__"}
        onValueChange={(val) =>
          pushParams({ category: val === "__all__" ? null : val })
        }
      >
        <SelectTrigger className="w-[150px] h-8">
          <SelectValue>
            {filters.category || "All categories"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c._id} value={c.name}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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
