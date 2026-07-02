# Quick-Entry Mode

Logging an expense through the full form requires filling seven fields across two rows, navigating to the expenses page if you're not already there. Most day-to-day expenses share the same defaults (50/50 split, deferred settlement) and only differ in amount, where, and tag. We decided to add a quick-entry mode — a minimal form accessible from any page — that reduces expense logging to three-to-four inputs with one-tap tag selection.

## Decisions

### 1. FAB + bottom drawer, not a dedicated page

A floating action button (bottom-right corner, `+` icon) opens a Vaul-based Drawer (ShadCN `Drawer` component) that slides up from the bottom. The FAB is visible on all dashboard pages except `/admin` routes. This keeps quick-entry one tap away without leaving the current context. A dedicated page would defeat the purpose — the user would have to navigate away and back.

### 2. Keyboard shortcut `n` repurposed for quick-entry

The existing `n` shortcut (which navigates to the expenses page and focuses the full form) is repurposed to open the quick-entry drawer from any dashboard page. The full form remains accessible by navigating to `/expenses` directly. The shortcut is updated in the keyboard shortcuts help dialog.

### 3. Four fields only: amount, where, date, and tags

The form shows a single column in this order:

1. **Amount** — text input with `$` prefix, auto-focused on open
2. **Where** — free-form text input
3. **Date** — pre-filled with today, editable for backdating
4. **Tags** — recent-tag chips (see decision 4)

Split type defaults to "split" (50/50), settlement type defaults to "deferred", paidBy defaults to the logged-in user, and notes defaults to empty. These hidden defaults cover the vast majority of expenses. Users who need different values use the full form.

### 4. Recent-tag chips instead of the full tag picker

The drawer shows the 5 most recently used tags by the current user (deduplicated) as one-tap chip buttons. When no history exists, the first 5 tags by `sortOrder` are shown as a fallback. A "More..." button opens the full `TagPicker` popover for the rare case where none of the recent tags apply. At least one tag must be selected before saving.

This avoids the friction of opening a popover and searching while still requiring a tag (tags are essential to settlement reports and breakdowns).

### 5. Two save actions: "Save" and "Save & add another"

"Save" (also triggered by `Enter`) saves the expense and closes the drawer. "Save & add another" (also triggered by `Ctrl+Enter`) saves the expense, shows a success toast, and resets the form for the next entry while keeping the drawer open. Both show a success toast on save.

### 6. Non-blocking duplicate detection

After saving, the system checks for an existing expense with the same date and amount. If found, a toast warning appears ("Heads up — this looks similar to an expense you already logged today"). The expense is already saved — no confirmation dialog interrupts the flow. This preserves the speed of quick-entry while still surfacing potential double-entries.

### 7. Full form escape hatch via URL params

A "Need more options? Full form" link in the drawer navigates to `/expenses` with current field values passed as URL search params (e.g., `/expenses?amount=12.50&where=Publix&date=2026-07-02&tagIds=abc,def`). The expense form reads these params as initial values and pre-fills accordingly. This uses the same URL search param pattern the app already uses for filters and navigation state — no new state management needed.

### 8. FAB hidden on admin pages

The FAB renders in the dashboard layout but is hidden on `/admin` routes. Admin pages are for configuration (tag management, CSV formats, people), not expense entry. Showing a FAB there would feel out of place.
