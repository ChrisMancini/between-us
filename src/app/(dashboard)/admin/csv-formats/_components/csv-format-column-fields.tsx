import {
  Controller,
  type Control,
  type UseFormRegister,
  type FieldErrors,
} from "react-hook-form";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CsvFormatFormValues } from "./csv-format-field-schema";

interface CsvFormatColumnFieldsProps {
  control: Control<CsvFormatFormValues>;
  register: UseFormRegister<CsvFormatFormValues>;
  errors: FieldErrors<CsvFormatFormValues>;
  amountType: "separate" | "single";
}

export function CsvFormatColumnFields({
  control,
  register,
  errors,
  amountType,
}: CsvFormatColumnFieldsProps) {
  return (
    <>
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="format-name">Name</Label>
        <Input
          id="format-name"
          placeholder="e.g. Citi Card"
          {...register("name")}
          className={cn(errors.name && "border-destructive")}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Date Column + Date Format */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="date-column">Date Column</Label>
          <Input
            id="date-column"
            placeholder="e.g. Date"
            {...register("dateColumn")}
            className={cn(errors.dateColumn && "border-destructive")}
          />
          {errors.dateColumn && (
            <p className="text-xs text-destructive">
              {errors.dateColumn.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Date Format</Label>
          <Controller
            control={control}
            name="dateFormat"
            render={({ field: f }) => (
              <Select value={f.value} onValueChange={f.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                  <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  <SelectItem value="MM-DD-YYYY">MM-DD-YYYY</SelectItem>
                  <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      {/* Description Column */}
      <div className="space-y-1.5">
        <Label htmlFor="desc-column">Merchant / Location Column</Label>
        <Input
          id="desc-column"
          placeholder="e.g. Description"
          {...register("descriptionColumn")}
          className={cn(errors.descriptionColumn && "border-destructive")}
        />
        {errors.descriptionColumn && (
          <p className="text-xs text-destructive">
            {errors.descriptionColumn.message}
          </p>
        )}
      </div>

      {/* Notes Column (optional) */}
      <div className="space-y-1.5">
        <Label htmlFor="notes-column">
          Notes Column{" "}
          <span className="text-muted-foreground font-normal">
            (optional)
          </span>
        </Label>
        <Input
          id="notes-column"
          placeholder="e.g. Memo"
          {...register("notesColumn")}
        />
        <p className="text-xs text-muted-foreground">
          If the CSV includes a memo or notes column, enter the header
          name to populate expense notes.
        </p>
      </div>

      {/* Amount Type */}
      <div className="space-y-1.5">
        <Label>Amount Type</Label>
        <Controller
          control={control}
          name="amountType"
          render={({ field: f }) => (
            <Select value={f.value} onValueChange={f.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {f.value === "separate"
                    ? "Separate Debit/Credit columns"
                    : "Single Amount column"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="separate">
                  Separate Debit/Credit columns
                </SelectItem>
                <SelectItem value="single">
                  Single Amount column
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {/* Conditional: Separate columns */}
      {amountType === "separate" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="debit-column">Debit Column (purchases)</Label>
            <Input
              id="debit-column"
              placeholder="e.g. Debit"
              {...register("debitColumn")}
              className={cn(errors.debitColumn && "border-destructive")}
            />
            {errors.debitColumn && (
              <p className="text-xs text-destructive">
                {errors.debitColumn.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="credit-column">Credit Column (payments)</Label>
            <Input
              id="credit-column"
              placeholder="e.g. Credit"
              {...register("creditColumn")}
              className={cn(errors.creditColumn && "border-destructive")}
            />
            {errors.creditColumn && (
              <p className="text-xs text-destructive">
                {errors.creditColumn.message}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Conditional: Single column */}
      {amountType === "single" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="amount-column">Amount Column</Label>
            <Input
              id="amount-column"
              placeholder="e.g. Amount"
              {...register("amountColumn")}
              className={cn(errors.amountColumn && "border-destructive")}
            />
            {errors.amountColumn && (
              <p className="text-xs text-destructive">
                {errors.amountColumn.message}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Purchase Sign</Label>
            <Controller
              control={control}
              name="purchaseSign"
              render={({ field: f }) => (
                <Select
                  value={f.value ?? ""}
                  onValueChange={f.onChange}
                >
                  <SelectTrigger
                    className={cn(
                      "w-full",
                      errors.purchaseSign && "border-destructive"
                    )}
                  >
                    <SelectValue placeholder="Select...">
                      {f.value === "positive"
                        ? "Purchases are positive"
                        : f.value === "negative"
                          ? "Purchases are negative"
                          : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="positive">
                      Purchases are positive
                    </SelectItem>
                    <SelectItem value="negative">
                      Purchases are negative
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.purchaseSign && (
              <p className="text-xs text-destructive">
                {errors.purchaseSign.message}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tag Column (optional) */}
      <div className="space-y-1.5">
        <Label htmlFor="tag-column">
          Tag Column{" "}
          <span className="text-muted-foreground font-normal">
            (optional)
          </span>
        </Label>
        <Input
          id="tag-column"
          placeholder="e.g. Tag, Category, Type"
          {...register("tagColumn")}
        />
        <p className="text-xs text-muted-foreground">
          If the CSV includes a category or tag column, enter the header
          name to enable tag mapping.
        </p>
      </div>
    </>
  );
}
