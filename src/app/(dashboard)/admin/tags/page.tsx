import { Plus } from "lucide-react";
import { connectToDatabase } from "@/lib/db";
import { Tag } from "@/lib/models/tag";
import { serializeTag } from "@/lib/tag-utils";
import type { SerializedTag } from "@/lib/models/tag";
import { Button } from "@/components/ui/button";
import { TagFormDialog } from "./_components/tag-form-dialog";
import { TagList } from "./_components/tag-list";

export const dynamic = "force-dynamic";

export default async function TagsPage() {
  await connectToDatabase();

  const rawTags = await Tag.find().lean();
  const tags: SerializedTag[] = rawTags.map(serializeTag);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tags</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Add, edit, or remove expense tags. Use{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">/</code> in
            tag paths to create nested tags (e.g. Vacation/Italy 2026).
          </p>
        </div>

        <TagFormDialog
          trigger={
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Tag
            </Button>
          }
        />
      </div>

      <TagList tags={tags} />
    </div>
  );
}
