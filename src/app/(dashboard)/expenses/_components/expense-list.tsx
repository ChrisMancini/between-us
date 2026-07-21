"use client";

import { useState, useMemo } from "react";
import type { SerializedExpense } from "@/lib/models/expense";
import type { SerializedTag } from "@/lib/models/tag";
import type { SettlementExpenseRow } from "@/lib/settlement-calc";
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

interface ExpenseListProps {
  expenses: SerializedExpense[];
  closedMonths: Set<string>;
  isFiltered?: boolean;
  currentUserKey?: string;
  isAdmin?: boolean;
  tags?: SerializedTag[];
  closedMonthsList?: string[];
}

export function ExpenseList({
  expenses,
  closedMonths,
  isFiltered = false,
  currentUserKey,
  isAdmin = false,
  tags,
  closedMonthsList,
}: ExpenseListProps) {
  const { personMap } = usePersons();
  const [deleteTarget, setDeleteTarget] = useState<SettlementExpenseRow | null>(null);

  const settledById = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const e of expenses) {
      const d = new Date(e.date);
      map.set(e._id, closedMonths.has(`${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`));
    }
    return map;
  }, [expenses, closedMonths]);

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
  } = useBulkSelection(expenses);

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
                {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
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
          {expenses.map((e) => (
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
        {expenses.map((e) => (
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
