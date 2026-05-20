"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { SerializedTag } from "@/lib/models/tag";

const formSchema = z.object({
  path: z
    .string()
    .min(1, "Path is required")
    .max(200, "Path must be 200 characters or fewer")
    .refine(
      (v) => !v.startsWith("/") && !v.endsWith("/"),
      "Path cannot start or end with /"
    )
    .refine(
      (v) => !v.split("/").some((s) => s.trim() === ""),
      "Path cannot have empty segments"
    ),
});

type FormValues = z.infer<typeof formSchema>;

interface TagFormDialogProps {
  tag?: SerializedTag;
  trigger: React.ReactElement;
}

export function TagFormDialog({ tag, trigger }: TagFormDialogProps) {
  const isEdit = !!tag;
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      path: tag?.path ?? "",
    },
  });

  function handleOpenChange(next: boolean) {
    if (next) {
      reset({ path: tag?.path ?? "" });
    }
    setOpen(next);
  }

  async function onSubmit(values: FormValues) {
    const url = isEdit ? `/api/tags/${tag!._id}` : "/api/tags";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: values.path }),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Failed to save tag");
      return;
    }

    toast.success(isEdit ? "Tag updated" : "Tag created");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Tag" : "New Tag"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the tag path. Renaming will cascade to all child tags."
              : "Enter a tag path. Use / to create nested tags (e.g. Bills/Electric). Parent tags are created automatically."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tag-path">Path</Label>
            <Input
              id="tag-path"
              placeholder="e.g. Vacation/Italy 2026"
              {...register("path")}
              className={cn(errors.path && "border-destructive")}
            />
            {errors.path && (
              <p className="text-xs text-destructive">
                {errors.path.message}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : isEdit
                  ? "Save Changes"
                  : "Create Tag"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
