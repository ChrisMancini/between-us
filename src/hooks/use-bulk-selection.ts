"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SerializedExpense } from "@/lib/models/expense";
import type { BulkEditValues } from "@/types/bulk-expense";

export function useBulkSelection(expenses: SerializedExpense[]) {
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmValues, setConfirmValues] = useState<BulkEditValues | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const exitBulkEdit = useCallback(() => {
    setBulkEditMode(false);
    setSelectedIds(new Set());
    setConfirmValues(null);
    setShowDeleteConfirm(false);
  }, []);

  const expenseIds = useMemo(
    () => new Set(expenses.map((e) => e._id)),
    [expenses]
  );

  const validSelectedIds = useMemo(
    () => new Set([...selectedIds].filter((id) => expenseIds.has(id))),
    [selectedIds, expenseIds]
  );

  useEffect(() => {
    if (!bulkEditMode) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") exitBulkEdit();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [bulkEditMode, exitBulkEdit]);

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (validSelectedIds.size === expenses.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(expenses.map((e) => e._id)));
    }
  }

  const selectedExpenses = useMemo(
    () => expenses.filter((e) => validSelectedIds.has(e._id)),
    [expenses, validSelectedIds]
  );
  const allSelected = expenses.length > 0 && validSelectedIds.size === expenses.length;
  const someSelected = validSelectedIds.size > 0 && validSelectedIds.size < expenses.length;

  return {
    bulkEditMode,
    setBulkEditMode,
    selectedIds: validSelectedIds,
    confirmValues,
    setConfirmValues,
    showDeleteConfirm,
    setShowDeleteConfirm,
    exitBulkEdit,
    toggleSelection,
    toggleSelectAll,
    selectedExpenses,
    allSelected,
    someSelected,
  };
}
