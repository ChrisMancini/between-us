"use client";

import { useState, useMemo } from "react";
import type { SerializedExpense } from "@/lib/models/expense";
import type { SerializedTag } from "@/lib/models/tag";
import type { SettlementExpenseRow } from "@/lib/settlement-calc";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollSentinel } from "@/components/scroll-sentinel";
import { usePersons } from "@/components/persons-context";
import { BulkEditBar } from "./bulk-edit-bar";
import { ExpenseRow } from "./expense-row";
import { ExpenseCard } from "./expense-card";
import { ExpenseListHeader } from "./expense-list-header";
import { ExpenseListDialogs } from "./expense-list-dialogs";
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useExpensePagination } from "@/hooks/use-expense-pagination";

interface ExpenseListProps {
  expenses: SerializedExpense[];
  totalCount: number;
  closedMonths: Set<string>;
  isFiltered?: boolean;
  currentUserKey?: string;
  isAdmin?: boolean;
  tags?: SerializedTag[];
  closedMonthsList?: string[];
  filters: {
    month: number | null;
    year: number;
    q: string;
    tag: string;
    paidBy: string;
  };
}

export function ExpenseList({
  expenses,
  totalCount,
  closedMonths,
  isFiltered = false,
  currentUserKey,
  isAdmin = false,
  tags,
  closedMonthsList,
  filters,
}: ExpenseListProps) {
  const { personMap } = usePersons();
  const [deleteTarget, setDeleteTarget] = useState<SettlementExpenseRow | null>(null);
  const { items, loading, hasMore, sentinelRef, loadMore } =
    useExpensePagination(expenses, totalCount, filters);

  useInfiniteScroll(sentinelRef, loadMore, hasMore && !loading);

  const settledById = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const e of items) {
      const d = new Date(e.date);
      map.set(e._id, closedMonths.has(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`));
    }
    return map;
  }, [items, closedMonths]);

  const {
    bulkEditMode,
    setBulkEditMode,
    selectedIds,
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
  } = useBulkSelection(items);

  if (expenses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-primary/20 bg-card py-16 text-center">
        <p className="text-sm text-muted-foreground">
          {isFiltered
            ? "No expenses match your filters."
            : "No expenses yet. Add your first one above."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/10 bg-card overflow-hidden shadow-sm">
      <ExpenseListHeader
        bulkEditMode={bulkEditMode}
        selectedCount={selectedIds.size}
        itemCount={items.length}
        totalCount={totalCount}
        onEnterBulkEdit={() => setBulkEditMode(true)}
        onExitBulkEdit={exitBulkEdit}
      />

      {bulkEditMode && selectedIds.size > 0 && tags && (
        <BulkEditBar
          selectedCount={selectedIds.size}
          tags={tags}
          onApply={(values) => setConfirmValues(values)}
          onDelete={() => setShowDeleteConfirm(true)}
          onCancel={exitBulkEdit}
        />
      )}

      {/* Desktop table — hidden below sm */}
      <table className="hidden sm:table w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {bulkEditMode && (
              <th className="w-10 px-4 py-2.5">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all expenses"
                />
              </th>
            )}
            <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground/60">Date</th>
            <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground/60">Where</th>
            <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground/60">Tags</th>
            <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground/60">Paid by</th>
            <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground/60">Split</th>
            <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground/60">Amount</th>
            {!bulkEditMode && <th className="w-20" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((e) => (
            <ExpenseRow
              key={e._id}
              expense={e}
              isSettled={settledById.get(e._id) ?? false}
              bulkEditMode={bulkEditMode}
              isSelected={selectedIds.has(e._id)}
              onToggleSelection={toggleSelection}
              onDelete={setDeleteTarget}
              currentUserKey={currentUserKey}
              tags={tags}
              closedMonthsList={closedMonthsList}
              personMap={personMap}
            />
          ))}
        </tbody>
      </table>

      {/* Mobile cards — hidden at sm and above */}
      <div className="sm:hidden divide-y divide-border">
        {bulkEditMode && (
          <div className="px-4 py-2.5 flex items-center gap-2">
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onCheckedChange={toggleSelectAll}
              aria-label="Select all expenses"
            />
            <span className="text-xs text-muted-foreground">Select all</span>
          </div>
        )}
        {items.map((e) => (
          <ExpenseCard
            key={e._id}
            expense={e}
            isSettled={settledById.get(e._id) ?? false}
            bulkEditMode={bulkEditMode}
            isSelected={selectedIds.has(e._id)}
            onToggleSelection={toggleSelection}
            onDelete={setDeleteTarget}
            currentUserKey={currentUserKey}
            tags={tags}
            closedMonthsList={closedMonthsList}
            personMap={personMap}
          />
        ))}
      </div>

      {hasMore && <ScrollSentinel ref={sentinelRef} loading={loading} />}

      <ExpenseListDialogs
        deleteTarget={deleteTarget}
        onCloseDeleteTarget={() => setDeleteTarget(null)}
        confirmValues={confirmValues}
        onCloseConfirmValues={() => setConfirmValues(null)}
        showDeleteConfirm={showDeleteConfirm}
        onCloseDeleteConfirm={() => setShowDeleteConfirm(false)}
        selectedExpenses={selectedExpenses}
        closedMonths={closedMonths}
        currentUserKey={currentUserKey}
        isAdmin={isAdmin}
        tags={tags}
        onBulkDone={exitBulkEdit}
      />
    </div>
  );
}
