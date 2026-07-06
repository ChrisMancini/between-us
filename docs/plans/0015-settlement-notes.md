# Settlement Notes — Implementation Plan

## Context

Both users want to annotate a closed settlement with payment context (e.g., "Paid via Zelle", "Venmo'd on 7/3") so the history page doubles as a lightweight payment log. The ADR (`docs/adr/0015-settlement-notes.md`) specifies an optional free-text `note` field on the Settlement model that can be edited inline on a closed month without triggering reopen, persists through reopen/re-close, and displays inside the NetResultCard.

---

## 1. Model & Types

**File:** `src/lib/models/settlement.ts`

- Add `note?: string` to `ISettlement` and `SerializedSettlement`
- Add `note: { type: String }` to the Mongoose schema (optional, no default)

**File:** `src/test/api-helpers.ts`

- Add `note?: string` to `makeSettlement` override type

---

## 2. API: Save note on close (POST)

**File:** `src/app/api/settlement/route.ts`

- Accept optional `note` (string, trimmed) from the POST body alongside `month`/`year`
- Pass `note` to both the `Settlement.create()` and `findByIdAndUpdate()` paths
- Include `note` in the serialized response

---

## 3. API: Update note on closed settlement (new PATCH)

**File:** `src/app/api/settlement/route.ts` (add `PATCH` export)

- Accept `{ month, year, note }` — `note` is a string (may be empty to clear)
- Look up the settlement; return 404 if not found
- Update `note` directly via `findByIdAndUpdate` — no status check needed (ADR decision: editable regardless of open/closed state)
- Return the updated settlement

This allows editing the note inline after the month is closed without reopening.

---

## 4. API: Preserve note through reopen

**File:** `src/app/api/settlement/reopen/route.ts`

- No changes needed — the reopen route sets `status`, `previousTotalOwed`, `previousOwedBy`, and `reopenedAt` via `$set`; it does not touch `note`, so it persists automatically.

---

## 5. API: Pre-fill note on re-close

**File:** `src/app/api/settlement/route.ts` (GET)

- When returning `previousSettlement` for an open/reopened month, also include `note` from the existing document so the re-close dialog can pre-fill it.

---

## 6. Close Month Dialog — note input

**File:** `src/app/(dashboard)/settlement/_components/close-month-dialog.tsx`

- Add a `Textarea` (from `@/components/ui/textarea`) below the summary/delta section
- Label: "Payment note (optional)" with placeholder like "e.g., Paid via Zelle"
- Controlled via `useState`, pre-filled from `existingNote` prop when re-closing
- Send `note` in the POST body to `/api/settlement`

**Props change:** Add `existingNote?: string` to `CloseMonthDialogProps`.

---

## 7. Settlement Page — pass note to dialog and NetResultCard

**File:** `src/app/(dashboard)/settlement/page.tsx`

- When serializing `closedSettlement`, include `note`
- Pass `existingNote={existing?.note}` to `CloseMonthDialog` (for re-close pre-fill)
- Pass `note` to `NetResultCard`

---

## 8. NetResultCard — display note

**File:** `src/app/(dashboard)/settlement/page.tsx` (NetResultCard sub-component)

- Add `note?: string` to props
- When `note` is present, render it as a secondary line below the "X owes Y $Z" text (or below "All settled" when even)
- Style: `text-sm text-muted-foreground italic` — visually subordinate to the amount

---

## 9. Inline note editing on closed settlement

**File:** `src/app/(dashboard)/settlement/_components/settlement-note.tsx` (new client component)

Since the settlement page is a server component, the inline edit interaction needs a client component:

- Receives `month`, `year`, `note` (current value or undefined), `isClosed`
- Renders inside NetResultCard (passed as a child or composed)
- When closed: shows the note text with a pencil icon button to enter edit mode
- Edit mode: replaces text with a `Textarea` + Save/Cancel buttons
- Save calls `PATCH /api/settlement` with the new note
- When open: shows read-only note (or nothing if empty) — editing during open state happens via the close dialog

---

## 10. History Page — show note

**File:** `src/app/(dashboard)/settlement/history/page.tsx`

- Add a "Note" column to the history table (or render it as a secondary line under the month name to avoid table width issues)
- Show the note text, truncated if long, with a tooltip for the full text

---

## 11. Tests

**File:** `src/app/api/settlement/__tests__/route-post.test.ts`

- Add test: note is saved when provided on close
- Add test: note is preserved through reopen and pre-filled on re-close
- Add test: note is omitted/null when not provided

**File:** `src/app/api/settlement/__tests__/route-patch.test.ts` (new)

- Add test: PATCH updates note on closed settlement
- Add test: PATCH clears note when empty string is sent
- Add test: PATCH returns 404 for nonexistent settlement

---

## Verification

1. `npm run type-check` — no TypeScript errors
2. `npm run lint` — no lint errors
3. Run existing settlement tests plus new ones
4. `npm run dev` — manually test:
   - Close a month with a note in the dialog → note appears in NetResultCard
   - Close a month without a note → no note shown
   - Edit note inline on a closed month → persists on refresh
   - Reopen a closed month with a note → re-close dialog pre-fills the note
   - History page shows notes
5. `npm run fallow:audit` — no regressions
