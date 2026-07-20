"use client";

import {
  Controller,
  useWatch,
  type Control,
  type UseFormRegister,
  type FieldErrors,
} from "react-hook-form";
import { CalendarClock } from "lucide-react";
import { cn, formatShortDate } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePickerField } from "@/components/date-picker-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  describeSchedule,
  nextOccurrenceOrNull,
} from "@/lib/recurring-schedule";
import {
  buildSchedulePayload,
  isScheduleComplete,
  ORDINAL_OPTIONS,
  SCHEDULE_TYPES,
  SCHEDULE_TYPE_LABELS,
  WEEKDAY_OPTIONS,
  type ScheduleType,
  type FormValues,
} from "./template-form-schema";

interface FieldProps {
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<FormValues>;
}

export function ScheduleConfigFields({ control, register, errors }: FieldProps) {
  const autoApplyEnabled = useWatch({ control, name: "autoApplyEnabled" });

  return (
    <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
      <Controller
        control={control}
        name="autoApplyEnabled"
        render={({ field: f }) => (
          <div className="flex items-start gap-2.5">
            <Checkbox
              id="auto-apply-enabled"
              checked={f.value}
              onCheckedChange={(checked) => f.onChange(checked === true)}
              className="mt-0.5"
            />
            <div className="space-y-0.5">
              <Label
                htmlFor="auto-apply-enabled"
                className="font-medium cursor-pointer"
              >
                Apply automatically on a schedule
              </Label>
              <p className="text-xs text-muted-foreground">
                Creates these expenses on the schedule below using the stored
                amounts — no need to apply by hand.
              </p>
            </div>
          </div>
        )}
      />

      {autoApplyEnabled && (
        <ScheduleBody control={control} register={register} errors={errors} />
      )}
    </div>
  );
}

function ScheduleBody({ control, register, errors }: FieldProps) {
  const scheduleType = useWatch({ control, name: "scheduleType" });

  return (
    <div className="space-y-3 pl-7">
      <div className="space-y-1.5">
        <Label htmlFor="schedule-type">Schedule</Label>
        <Controller
          control={control}
          name="scheduleType"
          render={({ field: f }) => (
            <Select value={f.value} onValueChange={(v) => f.onChange(v)}>
              <SelectTrigger id="schedule-type">
                <SelectValue>{SCHEDULE_TYPE_LABELS[f.value]}</SelectValue>
              </SelectTrigger>
              <SelectContent className="w-auto">
                {SCHEDULE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {SCHEDULE_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <FamilyParams
        scheduleType={scheduleType}
        control={control}
        register={register}
        errors={errors}
      />

      {scheduleType !== "nth_weekday" && (
        <WeekendAdjustToggle control={control} />
      )}

      <SchedulePreview control={control} />
    </div>
  );
}

function FamilyParams({
  scheduleType,
  control,
  register,
  errors,
}: FieldProps & { scheduleType: ScheduleType }) {
  switch (scheduleType) {
    case "day_of_month":
      return <DayOfMonthParams register={register} errors={errors} />;
    case "nth_weekday":
      return <NthWeekdayParams control={control} errors={errors} />;
    case "semi_monthly":
      return <SemiMonthlyParams register={register} errors={errors} />;
    case "every_n_weeks":
      return (
        <EveryNWeeksParams
          control={control}
          register={register}
          errors={errors}
        />
      );
    case "last_day_of_month":
      return null;
  }
}

function DayOfMonthParams({
  register,
  errors,
}: Pick<FieldProps, "register" | "errors">) {
  return (
    <FieldBlock
      label="Day of month"
      hint="Days past the end of a short month roll to the last day (31 = month-end)."
      error={errors.scheduleDay?.message}
    >
      <Input
        type="text"
        inputMode="numeric"
        placeholder="1–31"
        className={cn("w-24", errors.scheduleDay && "border-destructive")}
        {...register("scheduleDay")}
      />
    </FieldBlock>
  );
}

function NthWeekdayParams({
  control,
  errors,
}: Pick<FieldProps, "control" | "errors">) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <FieldBlock label="Week" error={errors.nthOrdinal?.message}>
        <Controller
          control={control}
          name="nthOrdinal"
          render={({ field: f }) => (
            <SimpleSelect
              value={f.value}
              onChange={f.onChange}
              options={ORDINAL_OPTIONS}
            />
          )}
        />
      </FieldBlock>
      <FieldBlock label="Weekday" error={errors.nthWeekday?.message}>
        <Controller
          control={control}
          name="nthWeekday"
          render={({ field: f }) => (
            <SimpleSelect
              value={f.value}
              onChange={f.onChange}
              options={WEEKDAY_OPTIONS}
            />
          )}
        />
      </FieldBlock>
    </div>
  );
}

function SemiMonthlyParams({
  register,
  errors,
}: Pick<FieldProps, "register" | "errors">) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <FieldBlock
        label="First day"
        hint='A day 1–31, or "last".'
        error={errors.semiDay1?.message}
      >
        <Input
          type="text"
          placeholder="15 or last"
          className={cn(errors.semiDay1 && "border-destructive")}
          {...register("semiDay1")}
        />
      </FieldBlock>
      <FieldBlock
        label="Second day"
        hint='A day 1–31, or "last".'
        error={errors.semiDay2?.message}
      >
        <Input
          type="text"
          placeholder="15 or last"
          className={cn(errors.semiDay2 && "border-destructive")}
          {...register("semiDay2")}
        />
      </FieldBlock>
    </div>
  );
}

function EveryNWeeksParams({
  control,
  register,
  errors,
}: Pick<FieldProps, "control" | "register" | "errors">) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <FieldBlock label="Every … weeks" error={errors.everyInterval?.message}>
        <Input
          type="text"
          inputMode="numeric"
          placeholder="2"
          className={cn("w-24", errors.everyInterval && "border-destructive")}
          {...register("everyInterval")}
        />
      </FieldBlock>
      <FieldBlock
        label="Starting"
        hint="The cadence is anchored to this date."
        error={errors.everyAnchorDate?.message}
      >
        <Controller
          control={control}
          name="everyAnchorDate"
          render={({ field }) => (
            <DatePickerField
              value={field.value}
              onChange={field.onChange}
              hasError={!!errors.everyAnchorDate}
            />
          )}
        />
      </FieldBlock>
    </div>
  );
}

function WeekendAdjustToggle({ control }: Pick<FieldProps, "control">) {
  return (
    <Controller
      control={control}
      name="weekendAdjustment"
      render={({ field: f }) => (
        <div className="flex items-start gap-2.5">
          <Checkbox
            id="weekend-adjustment"
            checked={f.value}
            onCheckedChange={(checked) => f.onChange(checked === true)}
            className="mt-0.5"
          />
          <Label
            htmlFor="weekend-adjustment"
            className="font-normal cursor-pointer text-sm"
          >
            If it lands on a weekend, roll to the next weekday
          </Label>
        </div>
      )}
    />
  );
}

function FieldBlock({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function SimpleSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
      <SelectTrigger>
        <SelectValue>{selected?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent className="w-auto">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Live plain-English summary and next-run date, driven by the same occurrence math
 * the runner uses (ADR-0018, decision 5), so a schedule is verifiable before it fires.
 */
function SchedulePreview({ control }: Pick<FieldProps, "control">) {
  const fields = useWatch({ control });

  const complete =
    !!fields.scheduleType &&
    isScheduleComplete(fields as Parameters<typeof isScheduleComplete>[0]);

  if (!complete) {
    return (
      <p className="text-xs text-muted-foreground">
        Finish the schedule above to preview when it will run.
      </p>
    );
  }

  const schedule = buildSchedulePayload({
    ...(fields as Parameters<typeof buildSchedulePayload>[0]),
    autoApplyEnabled: true,
  });
  if (!schedule) return null;

  const next = nextOccurrenceOrNull(schedule, new Date());

  return (
    <div className="flex items-start gap-2 rounded-md bg-background/60 px-3 py-2 text-xs">
      <CalendarClock
        className="h-4 w-4 shrink-0 text-muted-foreground mt-px"
        aria-hidden
      />
      <p className="text-foreground">
        {describeSchedule(schedule)}
        {next && (
          <span className="text-muted-foreground">
            {" · Next: "}
            {formatShortDate(next)}
          </span>
        )}
      </p>
    </div>
  );
}
