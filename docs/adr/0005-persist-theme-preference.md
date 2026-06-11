# Persist Theme Preference to Database

The light/dark theme toggle currently relies on next-themes' built-in localStorage persistence. This means the preference is browser-local — it doesn't follow the user across devices or survive a cache clear. Since we already have a `UserPreference` model with per-user database storage (used for dashboard widget preferences), the theme preference should live there too.

## Approach

Keep next-themes as the runtime engine (it handles the `class` attribute on `<html>`, system preference detection, and transition suppression). Add a database layer that:

1. **Saves** the chosen theme to the DB on toggle (fire-and-forget, same pattern as widget preferences)
2. **Loads** the saved theme on login and syncs it into next-themes via a `ThemeSync` client component

localStorage continues to act as a fast cache between page loads within the same browser. The database is the source of truth when a session starts.

## Considered Options

- **Replace next-themes entirely** — rejected; it handles `<html>` class injection, system preference, and SSR suppression well. No reason to reimplement.
- **Cookie-based persistence** — would enable server-side rendering of the correct theme, but adds complexity for marginal benefit in a two-user app.

## Implementation

### 1. Add `theme` field to `UserPreference` model

**File:** `src/lib/models/user-preference.ts`

Add `theme?: "light" | "dark" | "system"` to the `IUserPreference` interface and schema. Defaults to `undefined` (meaning "no preference saved yet — use next-themes default of system").

### 2. Add API route for theme preference

**New file:** `src/app/api/user-preferences/theme/route.ts`

`PUT /api/user-preferences/theme` — accepts `{ theme: "light" | "dark" | "system" }`, validates with Zod, upserts to `UserPreference` using `$set: { theme }`. Same `withAuth` pattern as the dashboard route.

### 3. Add Zod schema for theme preference

**File:** `src/lib/validations/user-preference.ts`

Add `themePreferenceSchema` validating `{ theme: z.enum(["light", "dark", "system"]) }`.

### 4. Create `ThemeSync` client component

**New file:** `src/components/theme-sync.tsx`

Accepts `savedTheme: string | undefined` as a prop. On mount, if `savedTheme` is defined, calls `setTheme(savedTheme)` from `useTheme()`. This runs once when the dashboard layout mounts to sync the DB value into next-themes.

### 5. Load theme in dashboard layout and render `ThemeSync`

**File:** `src/app/(dashboard)/layout.tsx`

Load the user's theme preference server-side (from `UserPreference.findOne`), pass it to `<ThemeSync savedTheme={...} />` inside the layout.

### 6. Update `ThemeToggle` to persist on toggle

**File:** `src/components/theme-toggle.tsx`

After calling `setTheme()`, fire-and-forget `fetch("/api/user-preferences/theme", { method: "PUT", body: ... })`.

## Files Modified

| File | Change |
|------|--------|
| `src/lib/models/user-preference.ts` | Add `theme` field to interface and schema |
| `src/lib/validations/user-preference.ts` | Add `themePreferenceSchema` |
| `src/app/api/user-preferences/theme/route.ts` | **New** — PUT endpoint for theme |
| `src/components/theme-sync.tsx` | **New** — syncs DB theme into next-themes on mount |
| `src/components/theme-toggle.tsx` | Add fire-and-forget DB save on toggle |
| `src/app/(dashboard)/layout.tsx` | Load theme pref, render `ThemeSync` |

## Verification

1. `npm run type-check` and `npm run lint`
2. `npm run fallow:audit` — ensure no dead code, unused exports, new circular dependencies, or complexity regressions (CI will fail otherwise)
3. `npm run dev` — verify:
   - Toggle theme, refresh — preference persists (same as before, via localStorage)
   - Sign out, clear localStorage, sign back in — theme restores from DB
   - Toggle to dark, open a different browser logged in as same user — theme syncs on load
   - "System" option: if we expose it, it should save and restore correctly
