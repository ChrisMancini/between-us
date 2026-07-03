import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { isDuplicateKeyError } from "@/lib/utils";
import { Tag } from "@/lib/models/tag";
import { Expense } from "@/lib/models/expense";
import { RecurringTemplate } from "@/lib/models/recurring-template";
import { tagApiSchema } from "@/lib/validations/tag";
import { serializeTag, ensureAncestors } from "@/lib/tag-utils";
import { withAdmin } from "@/lib/auth-guard";
import { validationError, invalidId, duplicateKeyResponse } from "@/lib/api-utils";
import { escapeRegex } from "@/lib/escape-regex";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const PUT = withAdmin<RouteContext>(async (req, _session, context) => {
  const { id } = await context.params;
  const idErr = invalidId(id);
  if (idErr) return idErr;

  const body = await req.json();
  const parsed = tagApiSchema.safeParse(body);

  if (!parsed.success) return validationError(parsed);

  const { path: newPath } = parsed.data;

  await connectToDatabase();

  const existing = await Tag.findById(id).lean();
  if (!existing) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  const oldPath = existing.path;

  await ensureAncestors(newPath);

  try {
    const updated = await Tag.findByIdAndUpdate(
      id,
      { path: newPath },
      { returnDocument: "after" }
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    const descendants = await Tag.find({
      path: { $regex: `^${escapeRegex(oldPath)}/`, $options: "i" },
    });

    for (const desc of descendants) {
      const suffix = desc.path.substring(oldPath.length);
      desc.path = newPath + suffix;
      await desc.save();
    }

    return NextResponse.json({ tag: serializeTag(updated) });
  } catch (err: unknown) {
    if (isDuplicateKeyError(err)) {
      return duplicateKeyResponse("A tag with this path already exists");
    }
    throw err;
  }
});

export const DELETE = withAdmin<RouteContext>(
  async (_req, _session, context) => {
    const { id } = await context.params;
    const idErr = invalidId(id);
    if (idErr) return idErr;

    await connectToDatabase();

    const tag = await Tag.findById(id).lean();
    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    const descendants = await Tag.find({
      path: { $regex: `^${escapeRegex(tag.path)}/`, $options: "i" },
    }).lean();

    const allIds = [
      new mongoose.Types.ObjectId(id),
      ...descendants.map((d) => d._id as mongoose.Types.ObjectId),
    ];

    const [expenseCount, templateCount] = await Promise.all([
      Expense.countDocuments({ tags: { $in: allIds } }),
      RecurringTemplate.countDocuments({ "items.tagIds": { $in: allIds } }),
    ]);

    if (expenseCount > 0 || templateCount > 0) {
      const parts: string[] = [];
      if (expenseCount > 0) parts.push(`${expenseCount} expense(s)`);
      if (templateCount > 0) parts.push(`${templateCount} template(s)`);
      return NextResponse.json(
        { error: `Cannot delete — tag is used by ${parts.join(" and ")}` },
        { status: 409 },
      );
    }

    await Tag.deleteMany({ _id: { $in: allIds } });

    const remaining = await Tag.find().sort({ sortOrder: 1 });
    if (remaining.length > 0) {
      await Tag.bulkWrite(
        remaining.map((t, i) => ({
          updateOne: {
            filter: { _id: t._id },
            update: { $set: { sortOrder: i + 1 } },
          },
        }))
      );
    }

    return NextResponse.json({ ok: true });
  }
);
