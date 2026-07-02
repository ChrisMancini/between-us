# Expand Search to Notes — Implementation Plan

## Context

The expense list search (`/expenses`) currently only matches against the `where` field using an unescaped case-insensitive regex. Users sometimes put useful context in the `notes` field and expect search to find it. This feature expands the search to match against both `where` and `notes` using OR logic, and fixes a minor issue where regex metacharacters in the search input are interpreted literally.

## Slices

### 1. Add regex escape utility

**New file:** `src/lib/escape-regex.ts`

Export a function `escapeRegex(str: string): string` that escapes all regex metacharacters so the input is treated as a literal substring. Characters to escape: `\ ^ $ . * + ? ( ) [ ] { } |`.

### 2. Expand query to OR across where and notes

**Modify:** `src/app/(dashboard)/expenses/page.tsx`

Replace the current single-field regex (line 59–61):

```ts
if (q) {
  query.where = { $regex: q, $options: "i" };
}
```

With an `$or` query that matches either field, using escaped input:

```ts
if (q) {
  const escaped = escapeRegex(q);
  query.$or = [
    { where: { $regex: escaped, $options: "i" } },
    { notes: { $regex: escaped, $options: "i" } },
  ];
}
```

Import `escapeRegex` from `src/lib/escape-regex.ts`.

### 3. Update search placeholder

**Modify:** `src/app/(dashboard)/expenses/_components/expense-filters.tsx`

Change the placeholder text on line 75 from `"Search where..."` to `"Search expenses..."`.

## Files Summary

**New (1):**
1. `src/lib/escape-regex.ts` — regex escape utility

**Modified (2):**
1. `src/app/(dashboard)/expenses/page.tsx` — `$or` query across `where` and `notes` with escaped input
2. `src/app/(dashboard)/expenses/_components/expense-filters.tsx` — updated placeholder text

## Verification

1. `npm run type-check` — no TypeScript errors
2. `npm run lint` — no lint errors
3. `npm run build` — successful production build
4. `npm run fallow:audit` — no regressions
5. Manual testing:
   - Search for a term that appears in `where` → results include the expense
   - Search for a term that appears only in `notes` → results include the expense
   - Search for a term that appears in neither → no results
   - Search with regex metacharacters (e.g., "FPL.") → treats as literal, does not match "FPLX"
   - Placeholder reads "Search expenses..."
