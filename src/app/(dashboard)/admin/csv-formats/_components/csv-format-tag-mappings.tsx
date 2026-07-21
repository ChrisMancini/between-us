import {
  Controller,
  useFieldArray,
  type Control,
  type UseFormRegister,
  type FieldErrors,
} from "react-hook-form";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagPicker } from "@/components/tag-picker";
import type { SerializedTag } from "@/lib/models/tag";
import type { CsvFormatFormValues } from "./csv-format-field-schema";

interface CsvFormatTagMappingsProps {
  control: Control<CsvFormatFormValues>;
  register: UseFormRegister<CsvFormatFormValues>;
  errors: FieldErrors<CsvFormatFormValues>;
  tags: SerializedTag[];
  onTagCreated: (tag: SerializedTag) => void;
}

export function CsvFormatTagMappings({
  control,
  register,
  errors,
  tags,
  onTagCreated,
}: CsvFormatTagMappingsProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "tagMappings",
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Tag Mappings</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 h-7 text-xs"
          onClick={() => append({ sourceValue: "", tagIds: [] })}
        >
          <Plus className="h-3 w-3" />
          Add Mapping
        </Button>
      </div>

      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No mappings yet. Unmapped values will need tags assigned during import.
        </p>
      )}

      <div className="space-y-2">
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-start gap-2">
            <div className="flex-1 space-y-1">
              <Input
                placeholder="CSV category value"
                {...register(`tagMappings.${index}.sourceValue`)}
                className={cn(
                  "h-8 text-sm",
                  errors.tagMappings?.[index]?.sourceValue &&
                    "border-destructive"
                )}
              />
            </div>
            <span className="text-xs text-muted-foreground mt-2">
              &rarr;
            </span>
            <div className="flex-1 space-y-1">
              <Controller
                control={control}
                name={`tagMappings.${index}.tagIds`}
                render={({ field: f }) => (
                  <TagPicker
                    tags={tags}
                    selectedTagIds={f.value ?? []}
                    onSelectedChange={f.onChange}
                    onTagCreated={onTagCreated}
                    error={!!errors.tagMappings?.[index]?.tagIds}
                  />
                )}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="mt-1 size-11 sm:size-6 text-muted-foreground hover:text-destructive"
              onClick={() => remove(index)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
