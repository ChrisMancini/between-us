"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const adminNavItems = [
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/csv-formats", label: "CSV Formats" },
  { href: "/admin/people", label: "People" },
  { href: "/admin/auth", label: "Auth" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 border-b border-border pb-px">
      {adminNavItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "relative px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
            {isActive && (
              <span className="absolute inset-x-1 -bottom-[calc(0.125rem+1px)] h-0.5 rounded-full bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
