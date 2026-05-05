import { cn } from "@/lib/utils";
import { PERSON_COLORS } from "@/lib/person-utils";

interface PersonBadgeProps {
  personKey: string;
  displayName: string;
  colorIndex: 0 | 1;
  className?: string;
}

export function PersonBadge({
  displayName,
  colorIndex,
  className,
}: PersonBadgeProps) {
  const colors = PERSON_COLORS[colorIndex];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colors.bg,
        colors.text,
        className
      )}
    >
      {displayName}
    </span>
  );
}
