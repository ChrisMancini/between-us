# Roadmap

## Data Export

- [ ] Export expenses to CSV (filtered by month, tags, person — matching current filter state)
- [ ] Export settlement summary to CSV or PDF for record-keeping
- [ ] Export annual report data (Year in Review) to a shareable format

## Reports & Insights

- [ ] Month-over-month comparison — select two months side-by-side to see spending deltas by tag
- [ ] Tag trend report — view a single tag's spending over time (6–12 month line)
- [ ] "Where" breakdown — top merchants/locations by spend, similar to tag breakdown
- [ ] Average daily spend indicator on the monthly report

## Expense Entry & Management

- [x] Duplicate detection on manual expense form (warn before saving if same date + amount exists)
- [x] Bulk edit — select multiple expenses and change tag, split type, or settlement type at once
- [x] Bulk delete with confirmation
- [x] Expand "where" search to also match notes field
- [x] Quick-entry mode — minimal form for rapid logging (amount + where only, with smart defaults)
- [ ] Possible bug. I entered an expense that had a date in which no other expenses had been entered. There wasn't an expense at all for that month. I received a possible duplicate expense notification. 

## Activity Feed

- [ ] Filter activity by action type (expense added, deleted, settlement closed, etc.)
- [ ] Date range filter on activity feed
- [ ] Inline links from activity items to the referenced expense or settlement

## Settlement

- [x] Settlement reminders — visual nudge on dashboard when a month is past due for closing
- [x] Settlement notes — optional free-text note when closing a month (e.g., "Paid via Zelle")
- [x] Running balance — show cumulative unsettled amount across all open months, not just current

## Recurring Templates

- [ ] Auto-apply option — schedule a template to apply automatically on a given day each month
- [ ] Template usage history — show when a template was last applied and how many times total
- [ ] Clone template — duplicate an existing template as a starting point for a new one

## UX Polish

- [ ] Adopt `formatMonthYear({ omitCurrentYear: true })` across the app — when displaying contextual month labels (dashboard header, report titles, settlement status, empty states), omit the year for the current year to reduce noise (e.g., "June" instead of "June 2026"). Keep the year in historical contexts where dates span multiple years (settlement history table, activity feed entries, stored action descriptions). Candidate call sites: `dashboard/page.tsx` label, `reports/page.tsx` headings and empty state, `settlement/page.tsx` status label and empty state, `month-nav.tsx` header, `expense-form-fields.tsx` month display. Do not change `action-lifecycle.ts` (descriptions are stored) or `settlement-guard.ts` (error messages referencing specific months).


- [ ] Loading skeletons for dashboard, reports, and expense list (Suspense boundaries with fallback UI)
- [ ] Expense table card layout on mobile — swap `<table>` for stacked cards below `sm` breakpoint
- [ ] Inline expense editing — click a row to edit in-place instead of navigating away or opening a dialog
- [ ] Pagination or infinite scroll on expense list (currently loads all expenses for the month)
- [ ] Review all features to ensure the application works on mobile devices

## Code Health

- [x] Suppress migration script complexity (run-once scripts, not production code)
- [x] Reduce cyclomatic complexity in SettlementPage (extract data-fetching into helper, extract alert banners into components)
- [ ] Reduce cyclomatic complexity in settlement POST handler (extract settlement creation logic)
- [x] Reduce cyclomatic complexity in BulkEditConfirmDialog and BulkDeleteConfirmDialog (extract shared two-phase confirmation pattern)
- [ ] Reduce cyclomatic complexity in bulk expense PATCH handler
- [ ] Reduce complexity in CsvFormatFormDialog
- [ ] Reduce complexity in expense PUT handler
- [ ] Reduce complexity in AuthSettingsForm handleSave
- [ ] Reduce complexity in FileUploadStep complete
- [ ] Reduce complexity in setup POST handler

## Reliability

- [ ] Consistent try/catch error handling across all API routes (wrap database operations, return structured errors)
- [ ] Client-side retry with exponential backoff for transient network failures on form submissions
- [ ] Optimistic UI updates for common actions (mark action as paid, delete expense)

## Accessibility

- [ ] Audit and add ARIA roles to custom composite components (tag picker, filter bar, widget grid)
- [ ] Visible focus ring styling pass — ensure all interactive elements have clear focus indicators
- [ ] Screen reader announcements for toast notifications and async state changes
