"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useActionCount } from "@/hooks/use-action-count";
import { buildNavItems } from "@/components/nav-items";

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const { count: actionCount } = useActionCount();
  const items = buildNavItems(isAdmin);

  return (
    // Desktop-only inline nav; the mobile drawer (MobileNav) covers < lg.
    <nav className="hidden lg:flex items-center">
      {items.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "focus-ring relative px-3.5 py-1 text-sm font-medium transition-colors rounded-md",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
            {item.href === "/dashboard" && actionCount > 0 && (
              <span className="absolute -top-1 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {actionCount}
              </span>
            )}
            {isActive && (
              <span className="absolute inset-x-2 -bottom-[calc(0.875rem+1px)] h-0.5 rounded-full bg-primary" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
