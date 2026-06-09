import { Tag, type ITag, type SerializedTag } from "./models/tag";

export function parsePath(path: string): {
  name: string;
  parent: string;
  depth: number;
} {
  const segments = path.split("/").map((s) => s.trim());
  return {
    name: segments[segments.length - 1],
    parent: segments.length > 1 ? segments.slice(0, -1).join("/") : "",
    depth: segments.length,
  };
}

export function getAncestorPaths(path: string): string[] {
  const segments = path.split("/").map((s) => s.trim());
  const ancestors: string[] = [];
  for (let i = 1; i < segments.length; i++) {
    ancestors.push(segments.slice(0, i).join("/"));
  }
  return ancestors;
}

export async function ensureAncestors(path: string): Promise<void> {
  const ancestors = getAncestorPaths(path);
  if (ancestors.length === 0) return;

  const maxSort = await Tag.findOne().sort({ sortOrder: -1 }).lean();
  let nextSort = (maxSort?.sortOrder ?? 0) + 1;

  for (const ancestorPath of ancestors) {
    const existing = await Tag.findOne({ path: ancestorPath }).collation({
      locale: "en",
      strength: 2,
    });
    if (!existing) {
      await Tag.create({ path: ancestorPath, sortOrder: nextSort++ });
    }
  }
}

export async function createTagWithSortOrder(path: string) {
  await ensureAncestors(path);
  const last = await Tag.findOne().sort({ sortOrder: -1 }).lean();
  const sortOrder = last ? last.sortOrder + 1 : 1;
  return Tag.create({ path, sortOrder });
}

export function serializeTag(
  doc: ITag | (Record<string, unknown> & { _id: unknown; path: string; sortOrder: number })
): SerializedTag {
  const { name, parent, depth } = parsePath(doc.path);
  return {
    _id: String(doc._id),
    path: doc.path,
    sortOrder: doc.sortOrder,
    name,
    parent,
    depth,
  };
}
