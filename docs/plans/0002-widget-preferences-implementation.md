# Dashboard Widget Preferences — Implementation Plan

## Context

The right-column dashboard widgets (Settlement Status, Activity, Shortcuts) are currently hardcoded in order with no user customization. ADR-0002 calls for making them collapsible and vertically reorderable via drag-and-drop, with per-user preferences persisted in MongoDB. This lets Chris and Lauren each arrange their dashboard to match their workflow.

The ADR defines four widget IDs (`actions`, `settlement-status`, `activity`, `shortcuts`), but the `actions` widget depends on the Action model (ADR-0001, not yet implemented). The implementation will register only the three existing widgets; `actions` will appear automatically when its component ships later.

CONTEXT.md confirms "Quick Actions" was renamed to "Shortcuts" — the component file needs to match.

## Implementation Steps

### 1. Install @dnd-kit packages

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @dnd-kit/modifiers
```

### 2. UserPreference Mongoose model

**New file:** `src/lib/models/user-preference.ts`

- `IUserPreference extends Document` with `userId: string`, `dashboard: { widgets: Array<{ widgetId: string; collapsed: boolean }> }`
- Unique index on `userId`
- Subdocument `_id: false` on widget entries
- Timestamps enabled
- Standard singleton export pattern: `mongoose.models.UserPreference ?? mongoose.model(...)`

No tests needed (models excluded from coverage).

### 3. Widget constants and merge utility

**New file:** `src/lib/widget-preferences.ts`

- `WIDGET_IDS` const array: `["actions", "settlement-status", "activity", "shortcuts"]`
- `WidgetId` type, `WidgetPreference` interface (`{ widgetId, collapsed }`)
- `DEFAULT_WIDGET_ORDER` matching ADR default
- `mergeWidgetPreferences(saved, knownIds)` — pure function that:
  - Returns defaults when `saved` is undefined/empty
  - Preserves saved order and collapsed state for known widgets
  - Drops saved entries for unknown/removed widget IDs
  - Appends new (unsaved) widgets at bottom, expanded, in default order

**New test file:** `src/lib/__tests__/widget-preferences.test.ts`

Tests: default order on undefined/empty, preserved order, unknown IDs stripped, new widgets appended, duplicate handling.

### 4. Zod validation schema

**New file:** `src/lib/validations/user-preference.ts`

- `dashboardWidgetPreferencesSchema` — `z.object({ widgets: z.array(z.object({ widgetId: z.enum(WIDGET_IDS), collapsed: z.boolean() })).min(1) })` with a `.refine()` rejecting duplicate widget IDs

No tests required (validations excluded from coverage), but can add later.

### 5. API route — `PUT /api/user-preferences/dashboard`

**New file:** `src/app/api/user-preferences/dashboard/route.ts`

- `withAuth` wrapper (any authenticated user)
- Zod validation via `safeParse`
- `UserPreference.findOneAndUpdate({ userId: session.user.id }, { $set: { "dashboard.widgets": ... } }, { upsert: true, new: true })`
- Returns `{ widgets: [...] }`
- Uses `validationError()` from `src/lib/api-utils.ts`

**New test file:** `src/app/api/user-preferences/dashboard/__tests__/route-put.test.ts`

Following the exact pattern from `csv-formats/[id]/__tests__/route-put.test.ts`:
- `jest.mock` for auth, db, model, validation at top
- Tests: 401 unauthenticated, 400 validation failure, 200 success with upsert, correct `userId` filter

### 6. Rename QuickActions to Shortcuts

- Rename `src/app/(dashboard)/dashboard/_components/quick-actions.tsx` to `shortcuts.tsx`
- Rename export `QuickActions` to `Shortcuts`
- Update header text from "Quick Actions" to "Shortcuts"
- Update import in `dashboard/page.tsx`

### 7. DashboardWidget wrapper component

**New file:** `src/app/(dashboard)/dashboard/_components/dashboard-widget.tsx`

Client component that wraps any widget content with:
- Header bar: GripVertical icon (left, DnD handle via `useSortable` listeners, hidden on mobile), title (center), ChevronDown button (right, toggles collapse)
- Collapse animation via CSS `grid-template-rows: 1fr`/`0fr` transition
- Outer container with the existing card styling (`rounded-xl border border-primary/10 bg-card shadow-sm overflow-hidden`)
- DnD transform/transition applied from `useSortable`
- Drag visual feedback (reduced opacity)

### 8. Strip headers from existing widgets

**Modify:** `settlement-status-card.tsx`, `activity-widget.tsx`, `shortcuts.tsx`

Remove from each:
- The outer `rounded-xl border ... shadow-sm overflow-hidden` wrapper div
- The header `div` with `border-b border-primary/10 bg-primary/5 px-5 py-3`

These components become content-only — the DashboardWidget wrapper provides the card chrome and header.

### 9. DashboardWidgetColumn component

**New file:** `src/app/(dashboard)/dashboard/_components/dashboard-widget-column.tsx`

Client component that:
- Receives `widgetPreferences` array and widget props (settlement data, activities) from the server
- Maintains local state for order and collapse
- Sets up `DndContext` with `PointerSensor`, `KeyboardSensor` (desktop only via `matchMedia`), `closestCenter`, `restrictToVerticalAxis`
- Renders widgets in preference order using a registry map:
  - `"settlement-status"` -> `SettlementStatusCard`
  - `"activity"` -> `ActivityWidget`
  - `"shortcuts"` -> `Shortcuts`
  - Widget IDs not in registry (e.g. `actions`) are silently skipped
- Each widget wrapped in `<DashboardWidget>` with title, collapse state, and toggle handler
- On drag end: `arrayMove` + fire-and-forget `PUT /api/user-preferences/dashboard`
- On collapse toggle: update state + fire-and-forget PUT
- Optimistic UI — interactions are instant, saves happen in background

### 10. Dashboard page integration

**Modify:** `src/app/(dashboard)/dashboard/page.tsx`

- Import `UserPreference` model and `mergeWidgetPreferences`
- Add 8th query to `Promise.all`: `UserPreference.findOne({ userId: session.user.id }).lean()`
- Call `mergeWidgetPreferences(userPref?.dashboard?.widgets)` after Promise.all
- Replace the hardcoded right-column widgets with `<DashboardWidgetColumn widgetPreferences={...} settlementProps={...} activities={...} />`
- Remove direct imports of `SettlementStatusCard`, `ActivityWidget`, `QuickActions`

## Implementation Order

```
Steps 1-3, 6 — independent, can be parallel
Step 4       — depends on step 3 (imports WIDGET_IDS)
Step 5       — depends on steps 2, 4
Step 7       — depends on step 1 (@dnd-kit)
Step 8       — depends on steps 6, 7
Step 9       — depends on steps 3, 7, 8
Step 10      — depends on steps 2, 3, 9
```

## Verification

1. **Tests pass:** `npm test` — new tests for merge utility and API route, existing tests unbroken
2. **Coverage holds:** `npm test -- --coverage` — 80% threshold on `src/lib/widget-preferences.ts` and `src/app/api/user-preferences/dashboard/route.ts`
3. **Type check:** `npm run type-check`
4. **Lint:** `npm run lint`
5. **Manual testing:** `npm run dev` then:
   - Dashboard loads with widgets in default order
   - Drag a widget to reorder — order persists on refresh
   - Click chevron to collapse/expand — state persists on refresh
   - Resize to mobile — grip dots hidden, collapse still works, saved order respected
   - Log in as the other user — they get independent preferences
