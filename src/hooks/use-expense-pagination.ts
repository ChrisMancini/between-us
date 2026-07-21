"use client";

import { useState, useRef, useCallback } from "react";
import type { SerializedExpense } from "@/lib/models/expense";
import { EXPENSE_PAGE_SIZE } from "@/app/(dashboard)/expenses/_lib/constants";

interface ExpenseFilters {
  month: number | null;
  year: number;
  q: string;
  tag: string;
  paidBy: string;
}

export function useExpensePagination(
  initialExpenses: SerializedExpense[],
  totalCount: number,
  filters: ExpenseFilters,
) {
  const [items, setItems] = useState(initialExpenses);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialExpenses.length < totalCount);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.month !== null) params.set("month", String(filters.month));
      else params.set("month", "all");
      params.set("year", String(filters.year));
      if (filters.q) params.set("q", filters.q);
      if (filters.tag) params.set("tag", filters.tag);
      if (filters.paidBy) params.set("paidBy", filters.paidBy);
      params.set("offset", String(items.length));
      params.set("limit", String(EXPENSE_PAGE_SIZE));

      const res = await fetch(`/api/expenses?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setItems((prev) => [...prev, ...data.expenses]);
      setHasMore(data.hasMore);
    } finally {
      setLoading(false);
    }
  }, [loading, items.length, filters]);

  return { items, loading, hasMore, sentinelRef, loadMore };
}
