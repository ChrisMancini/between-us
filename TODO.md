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
- [x] Possible bug. I entered an expense that had a date in which no other expenses had been entered. There wasn't an expense at all for that month. I received a possible duplicate expense notification.
- [x] Tag validation — decide whether to forbid tagging an expense with both a parent and one of its descendants (e.g., `Bills` and `Bills/Electric`). Prevents double-counting within parent rollups in reports. Cross-cutting: would apply at the manual expense form, quick-entry, bulk edit, recurring templates, and CSV import. Note: a going-forward rule does not retroactively clean historical data, so rollup reports must still handle co-tagging gracefully. (Surfaced while planning the month-over-month comparison feature.)

## Activity Feed

- [x] Inline links from activity items to the referenced expense or settlement

## Settlement

- [x] Settlement reminders — visual nudge on dashboard when a month is past due for closing
- [x] Settlement notes — optional free-text note when closing a month (e.g., "Paid via Zelle")
- [x] Running balance — show cumulative unsettled amount across all open months, not just current

## Recurring Templates

- [ ] Auto-apply option — schedule a template to apply automatically on a given day each month
- [x] Template usage history — show when a template was last applied and how many times total
- [ ] Clone template — duplicate an existing template as a starting point for a new one

## Documentation

- [ ] Scrub partner names (Chris/Lauren) from repo docs and code — genericize to role descriptors or Partner A/B. In scope: `docs/adr/*` and `docs/plans/*` personas + example UI strings (e.g. "Chris owes Lauren $70" → "Partner A owes Partner B $70"), test fixtures in `src/lib/__tests__/action-lifecycle.test.ts` (re-run after), and any `compare-prototype/` comment references still present when that throwaway folder is folded in. Leave intact: the `LICENSE` copyright line (legal authorship) and the `ChrisMancini/between-us` GitHub repo slug/URL in `app-footer.tsx` and `docs/agents/issue-tracker.md` (functional link, not prose). (The comparison-feature issues #37/#47/#48 have already been scrubbed.)
- [x] Revise "Deploying to Synology NAS" section in README — deploy.mjs now recreates the container automatically (stop → rm → run), and defaults to container name `ghcr-io-chrismancini-between-us`. The manual GUI setup instructions in step 3 and the container name are out of date.

## Code Health

- [x] Suppress migration script complexity (run-once scripts, not production code)
- [x] Reduce cyclomatic complexity in SettlementPage (extract data-fetching into helper, extract alert banners into components)
- [x] Reduce cyclomatic complexity in settlement POST handler (extract settlement creation logic)
- [x] Reduce cyclomatic complexity in BulkEditConfirmDialog and BulkDeleteConfirmDialog (extract shared two-phase confirmation pattern)
- [x] Reduce cyclomatic complexity in bulk expense PATCH handler
- [x] Reduce complexity in CsvFormatFormDialog
- [x] Reduce complexity in expense PUT handler
- [x] Reduce complexity in AuthSettingsForm handleSave
- [x] Reduce complexity in FileUploadStep complete
- [x] Reduce complexity in setup POST handler

## Reliability

- [ ] Consistent try/catch error handling across all API routes (wrap database operations, return structured errors)
- [ ] Client-side retry with exponential backoff for transient network failures on form submissions
- [ ] Optimistic UI updates for common actions (mark action as paid, delete expense)

## Accessibility

- [ ] Audit and add ARIA roles to custom composite components (tag picker, filter bar, widget grid)
- [ ] Visible focus ring styling pass — ensure all interactive elements have clear focus indicators
- [ ] Screen reader announcements for toast notifications and async state changes
