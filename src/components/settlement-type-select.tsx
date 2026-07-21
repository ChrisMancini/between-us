"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SettlementTypeSelectProps {
  value: "immediate" | "deferred";
  onChange: (value: "immediate" | "deferred") => void;
  error?: boolean;
}

export function SettlementTypeSelect({
  value,
  onChange,
  error,
}: SettlementTypeSelectProps) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as "immediate" | "deferred")}
    >
      <SelectTrigger className={error ? "border-destructive" : undefined}>
        <SelectValue>
          {value === "immediate" ? "Immediate" : "Deferred"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-auto max-w-[calc(100vw-2rem)]">
        <SelectItem value="deferred">Deferred — settled monthly</SelectItem>
        <SelectItem value="immediate">
          Immediate — settled at time of expense
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
