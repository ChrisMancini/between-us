# Global Keyboard Shortcuts (Hotkeys)

Users navigate Between Us frequently and want a keyboard-driven flow. This ADR documents the design decisions behind the global hotkey system.

## Decisions

### 1. g+letter chord for navigation, single keys for actions

Navigation shortcuts use a two-key chord (`g` then a letter) rather than bare single keys. This avoids accidental fires when a user types a letter while not focused in an input but not consciously using a shortcut, and aligns with GitHub's well-understood convention.

Action shortcuts (`n`, `?`) use single keys because they're deliberate, high-value triggers with low risk of accidental activation.

| Key | Action |
|-----|--------|
| `?` | Open keyboard shortcuts help |
| `n` | Navigate to /expenses (focus date field if already there) |
| `g` `d` | Go to Dashboard |
| `g` `e` | Go to Expenses |
| `g` `r` | Go to Reports |
| `g` `s` | Go to Settlement |
| `g` `a` | Go to Activity |
| `g` `t` | Go to Recurring (T for Templates) |

All shortcuts are suppressed when focus is inside an `<input>`, `<textarea>`, or `<select>`.

### 2. No third-party hotkey library

The feature is simple enough (one chord sequence, one action key, one help toggle) that a custom `useHotkeys` hook with `document.addEventListener("keydown")` is sufficient. Adding a library for this surface area would be over-engineering.

### 3. `n` navigates to /expenses rather than opening a global dialog

The Add Expense form is always-visible inline on `/expenses` — it is not a dialog. `n` navigates to that page, or focuses the date field if the user is already there. A global Add Expense dialog that can open from any page is a meaningful separate feature and is deferred.

## Implementation

- **`src/hooks/use-hotkeys.ts`** — custom hook: registers global keydown listener, tracks `g` chord state via a ref, suppresses in inputs, manages `shortcutsOpen` dialog state, exports `FOCUS_EXPENSE_FORM_EVENT`
- **`src/components/keyboard-shortcuts-dialog.tsx`** — ShadCN Dialog with two sections (Navigation, Actions), `<kbd>` chips, Escape-to-dismiss
- **`src/components/hotkey-handler.tsx`** — client component that calls `useHotkeys()` and renders the dialog; mounted in dashboard layout
- **`src/app/(dashboard)/layout.tsx`** — mounts `<HotkeyHandler />`
- **`src/app/(dashboard)/expenses/_components/expense-form.tsx`** — listens for `FOCUS_EXPENSE_FORM_EVENT` and focuses the date field
