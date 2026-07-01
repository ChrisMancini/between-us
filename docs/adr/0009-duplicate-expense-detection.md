# Duplicate Expense Detection on Manual Entry

The manual expense form has no duplicate detection, even though CSV import already checks for duplicates using date + amount. Users can accidentally submit the same expense twice — especially when both partners log the same purchase — and the error silently inflates the settlement. We decided to add a pre-save duplicate check to the manual form, reusing the same matching logic as CSV import.

## Decisions

### 1. Match on date + amount only, surface `where` in the warning

We considered adding the `where` field to the match criteria (exact or fuzzy). Exact `where` matching would miss trivial variations ("Publix" vs "PUBLIX #1234"), and fuzzy matching (contains, Levenshtein) adds complexity for marginal benefit. Since this is a warning — not a block — false positives are cheap (user dismisses), while false negatives (missed duplicates) affect settlement accuracy.

The existing expense's `where` value is displayed in the confirmation dialog so the user can judge whether it's a real duplicate.

### 2. Check fires on submit, not on field change

The form is optimized for speed of entry. Running the check as the user types (on blur of the amount field) would cause warnings to flicker mid-entry. Checking on submit — after the user has committed to their input — is a natural "pause and think" moment consistent with how the app handles other confirmations (delete, close month, reopen).

### 3. Exact date match, no +/- 1 day window

We considered a 1-day window to catch transaction-date-vs-posting-date discrepancies. On the manual form, the user picks the date themselves — they know when the expense happened. The off-by-one problem is a CSV/bank-statement issue, not a manual-entry issue. A 1-day window would generate false positives for households that shop at the same places on consecutive days.

### 4. Confirmation dialog, not toast

A ShadCN Dialog with "Cancel" and "Save Anyway" buttons, consistent with DeleteDialog, CloseMonthDialog, and ReopenMonthDialog. Toasts are used for feedback after actions, not as gates before them.

### 5. Best-effort, no hard block on failure

If the duplicate check API call fails, the expense saves without warning — same contract as CSV import. The check is a courtesy, not a data integrity gate.

### 6. Shared matching logic across CSV import and manual form

The duplicate matching logic (fetch expenses by date range, build date+amount key map) is extracted into a shared function rather than duplicated. Both features use the same API endpoint and the same client-side matching.
