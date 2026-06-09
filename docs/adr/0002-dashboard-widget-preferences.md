# Dashboard widget preferences

The right-column dashboard widgets (Actions, Settlement Status, Activity, Shortcuts) need to be collapsible and vertically reorderable via drag-and-drop, with per-user preferences persisted in the database. We introduced a `UserPreference` model, chose @dnd-kit for drag-and-drop, and designed a generic `<DashboardWidget>` wrapper component so individual widgets don't know they're draggable or collapsible.

## Key decisions

**Per-user preferences in a general-purpose `UserPreference` document.** Each user gets one `UserPreference` document with a `dashboard.widgets` array (ordered, each entry has `widgetId` and `collapsed`). Array position is the source of truth for ordering — no redundant `sortOrder` field. We chose a general-purpose document over a dedicated `DashboardLayout` model because this is the first per-user preference but won't be the last; sibling keys can be added without new collections.

**Right column only.** Left-column widgets (Spending Summary, Recent Expenses) are primary content and don't get drag/collapse chrome. Only the four right-column utility widgets are interactive: `actions`, `settlement-status`, `activity`, `shortcuts`. These string IDs are stable logical identifiers, not tied to component filenames.

**@dnd-kit over react-beautiful-dnd and native DnD.** @dnd-kit provides keyboard drag-and-drop accessibility out of the box (one user is keyboard-driven, the other mouse-driven), is actively maintained, and is lightweight (~12KB gzipped). react-beautiful-dnd is deprecated and has React 18 strict mode issues. Native HTML DnD has poor accessibility and no smooth animations.

**Generic `<DashboardWidget>` wrapper.** A single wrapper component owns the header bar (grip dots left, title center, chevron right), collapse animation, and DnD handle registration. Content widgets are passed as children and stay pure — no DnD or collapse awareness. Adding a future widget means wrapping it in `<DashboardWidget>` with an ID and title.

**Chevron-only collapse, header-bar drag.** Clicking the chevron toggles collapse/expand. Clicking anywhere else on the header does nothing on a plain click — it only activates on drag. This cleanly separates the two interactions with no ambiguity.

**Drag-and-drop disabled on mobile.** Collapse/expand works on all screen sizes, but drag-and-drop is desktop-only (grip dots hidden on small screens). Touch DnD on a single-column scrolling layout causes scroll/drag conflicts. The saved order from desktop still applies on mobile.

**Server-side preference loading.** `UserPreference` is fetched in the existing `Promise.all` on the dashboard page — no layout shift, no client-side fetch-then-reorder. The client wrapper only handles drag/collapse interactions and POSTs updates.

**Eager saves with full replacement.** Every drag or collapse fires `PUT /api/user-preferences/dashboard` with the full widget array. Optimistic UI — the interaction feels instant, the save happens in the background. The widget array is 4 items; full replacement is simpler than granular patches and idempotent by nature.

**New widgets append to the bottom.** When a widget exists in code but not in a user's saved preferences (e.g., a newly shipped widget), it appears at the bottom of the right column, expanded. No disruption to existing layout.

## Considered alternatives

- **Shared (not per-user) preferences**: Rejected because the two users have different workflows (keyboard vs mouse) and will likely want different widget arrangements.
- **Debounced or explicit-save persistence**: Rejected because widget rearrangement is infrequent — eager saves are simpler with no risk of lost state on tab close.
- **Granular API endpoints** (separate order and collapse endpoints): Rejected because the payload is tiny and full replacement eliminates partial-update edge cases.
- **Dedicated `DashboardLayout` model**: Rejected in favor of a general-purpose `UserPreference` document that can grow to hold other per-user settings without new collections.

## Widget IDs

| Widget | `widgetId` |
|--------|-----------|
| Actions | `actions` |
| Settlement Status | `settlement-status` |
| Activity | `activity` |
| Shortcuts | `shortcuts` |

## Default order (new users, no saved preferences)

1. `actions`
2. `settlement-status`
3. `activity`
4. `shortcuts`
