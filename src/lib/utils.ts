import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNow } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export function formatMonthYear(month: number, year: number, options?: { omitCurrentYear?: boolean }): string {
  if (options?.omitCurrentYear && year === new Date().getUTCFullYear()) {
    return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
      month: "long",
      timeZone: "UTC",
    });
  }
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function parseMonthYearParams(params: { month?: string; year?: string }) {
  const now = new Date();
  return {
    month: parseInt(params.month ?? "") || now.getMonth() + 1,
    year: parseInt(params.year ?? "") || now.getFullYear(),
  };
}

export function getMonthDateRange(month: number, year: number) {
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

export function formatActivityDate(date: string | Date, includeYear = false) {
  const d = new Date(date);
  return {
    timeAgo: formatDistanceToNow(d, { addSuffix: true }),
    fullDate: d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      ...(includeYear ? { year: "numeric" } : {}),
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

export function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: number }).code === 11000
  );
}
