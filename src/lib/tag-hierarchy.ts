/**
 * Pure tag-hierarchy logic — no DB access, safe to import from client components.
 * Selecting a descendant tag (e.g. "Bills/Electric") implies its ancestors
 * (e.g. "Bills"), so an ancestor should never be selected alongside one of
 * its own descendants.
 */

export function collapseToMostSpecific(
  selectedIds: string[],
  pathById: Map<string, string>
): string[] {
  const paths = selectedIds.map((id) => pathById.get(id));

  return selectedIds.filter((_, i) => {
    const path = paths[i];
    if (path === undefined) return true;
    return !paths.some(
      (other, j) => j !== i && other !== undefined && other.startsWith(`${path}/`)
    );
  });
}
