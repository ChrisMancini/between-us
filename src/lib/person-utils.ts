import type { SerializedPerson, PersonPair } from "@/types/person";

export type { SerializedPerson, PersonPair } from "@/types/person";

export const PERSON_COLORS = [
  {
    bg: "bg-indigo-100 dark:bg-indigo-900/40",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-400 dark:border-indigo-500",
    selectedBg: "bg-indigo-50/60 dark:bg-indigo-900/30",
    accent: "text-indigo-700 dark:text-indigo-400",
    chartLabel: "text-primary/70",
    chartIcon: "text-primary/70",
  },
  {
    bg: "bg-violet-100 dark:bg-violet-900/40",
    text: "text-violet-700 dark:text-violet-300",
    border: "border-violet-400 dark:border-violet-500",
    selectedBg: "bg-violet-50/60 dark:bg-violet-900/30",
    accent: "text-violet-700 dark:text-violet-400",
    chartLabel: "text-violet-600 dark:text-violet-400",
    chartIcon: "text-violet-600 dark:text-violet-400",
  },
] as const;

export function buildPersonMap(
  persons: PersonPair
): Map<string, SerializedPerson> {
  return new Map(persons.map((p) => [p.key, p]));
}

export function badgeProps(
  personKey: string,
  personMap: Map<string, SerializedPerson>
) {
  const p = personMap.get(personKey);
  return {
    personKey,
    displayName: p?.displayName ?? personKey,
    colorIndex: (p?.colorIndex ?? 0) as 0 | 1,
  };
}
