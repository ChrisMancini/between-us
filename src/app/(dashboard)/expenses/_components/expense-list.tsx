"use client";

import { useState, useMemo, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import type { SerializedExpense } from "@/lib/models/expense";
import type { SerializedTag } from "@/lib/models/tag";
import type { SettlementExpenseRow } from "@/lib/settlement-calc";
import { EXPENSE_PAGE_SIZE } from "../_lib/constants";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { usePersons } from "@/components/persons-context";
import { DeleteDialog } from "@/components/delete-dialog";
import { BulkEditBar } from "./bulk-edit-bar";
import { BulkEditConfirmDialog } from "./bulk-edit-confirm-dialog";
import { BulkDeleteConfirmDialog } from "./bulk-delete-confirm-dialog";
import { ExpenseRow } from "./expense-row";
import { ExpenseCard } from "./expense-card";
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";

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
  const [items, setItems] = useState(expenses);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(expenses.length < totalCount);
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
      <div className="border-b border-primary/10 bg-primary/5 px-4 py-2.5 flex items-center justify-between">
        {bulkEditMode ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
              {selectedIds.size} selected
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={exitBulkEdit}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
              Expenses
            </p>
            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground">
                {items.length === totalCount
                  ? `${totalCount} ${totalCount === 1 ? "expense" : "expenses"}`
                  : `Showing ${items.length} of ${totalCount}`}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setBulkEditMode(true)}
              >
                Bulk Edit
              </Button>
            </div>
          </>
        )}
      </div>

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

      {/* Infinite scroll sentinel + loading indicator */}
      {hasMore && (
        <div ref={sentinelRef} className="border-t border-border px-4 py-3 flex items-center justify-center">
          {loading && (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading more...
            </span>
          )}
        </div>
      )}

      {deleteTarget && (
        <DeleteDialog
          endpoint={`/api/expenses/${deleteTarget._id}`}
          itemType="expense"
          itemLabel={deleteTarget.where}
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        />
      )}

      {confirmValues && tags && currentUserKey && (
        <BulkEditConfirmDialog
          open={!!confirmValues}
          onOpenChange={(open) => {
            if (!open) setConfirmValues(null);
          }}
          selectedExpenses={selectedExpenses}
          closedMonths={closedMonths}
          currentUserKey={currentUserKey}
          isAdmin={isAdmin}
          values={confirmValues}
          tags={tags}
          onDone={exitBulkEdit}
        />
      )}

      {showDeleteConfirm && currentUserKey && (
        <BulkDeleteConfirmDialog
          open={showDeleteConfirm}
          onOpenChange={(open) => {
            if (!open) setShowDeleteConfirm(false);
          }}
          selectedExpenses={selectedExpenses}
          closedMonths={closedMonths}
          currentUserKey={currentUserKey}
          isAdmin={isAdmin}
          onDone={exitBulkEdit}
        />
      )}
    </div>
  );
}
