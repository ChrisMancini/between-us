"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { SerializedCategory } from "@/lib/models/category";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(50),
  settlementType: z.enum(["immediate", "deferred"]),
});

type FormValues = z.infer<typeof formSchema>;

interface CategoryFormDialogProps {
  category?: SerializedCategory;
  trigger: React.ReactElement;
}

export function CategoryFormDialog({
  category,
  trigger,
}: CategoryFormDialogProps) {
  const isEdit = !!category;
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: category?.name ?? "",
      settlementType: category?.settlementType ?? "deferred",
    },
  });

  function handleOpenChange(next: boolean) {
    if (next) {
      reset({
        name: category?.name ?? "",
        settlementType: category?.settlementType ?? "deferred",
      });
    }
    setOpen(next);
  }

  async function onSubmit(values: FormValues) {
    const url = isEdit
      ? `/api/categories/${category!._id}`
      : "/api/categories";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error ?? "Failed to save category");
      return;
    }

    toast.success(isEdit ? "Category updated" : "Category created");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit Category" : "New Category"}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update the category name and settlement type."
                : "Add a new expense category."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="category-name">Name</Label>
              <Input
                id="category-name"
                placeholder="e.g. Groceries"
                {...register("name")}
                className={cn(errors.name && "border-destructive")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Settlement Type</Label>
              <Controller
                control={control}
                name="settlementType"
                render={({ field: f }) => (
                  <Select value={f.value} onValueChange={f.onChange}>
                    <SelectTrigger
                      className={cn(
                        "w-full",
                        errors.settlementType && "border-destructive"
                      )}
                    >
                      <SelectValue>
                        {f.value === "immediate" ? "Immediate" : "Deferred"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="deferred">
                        Deferred — settled monthly
                      </SelectItem>
                      <SelectItem value="immediate">
                        Immediate — settled at time of expense
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.settlementType && (
                <p className="text-xs text-destructive">
                  {errors.settlementType.message}
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
                  ? "Saving…"
                  : isEdit
                    ? "Save Changes"
                    : "Create Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
    </Dialog>
  );
}
