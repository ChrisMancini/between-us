"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useActionCount } from "@/hooks/use-action-count";
import { buildNavItems } from "@/components/nav-items";

export function MobileNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const { count: actionCount } = useActionCount();
  const [open, setOpen] = useState(false);
  const items = buildNavItems(isAdmin);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        className="h-11 w-11 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Drawer open={open} onOpenChange={setOpen} swipeDirection="left">
        <DrawerContent>
          <DrawerHeader className="border-b border-border">
            <DrawerTitle className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shadow-sm shadow-primary/40">
                <Receipt className="h-4 w-4 text-primary-foreground" />
              </span>
              Between Us
            </DrawerTitle>
          </DrawerHeader>

          <nav className="flex flex-col overflow-y-auto p-2">
            {items.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    // 44px min touch target; active state uses weight + a left
                    // accent bar (shape), never colour alone (color-blind support).
                    "flex min-h-11 items-center gap-2 rounded-md border-l-2 px-3 text-sm transition-colors",
                    isActive
                      ? "border-primary bg-accent font-semibold text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  )}
                >
                  {item.label}
                  {item.href === "/dashboard" && actionCount > 0 && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                      {actionCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </DrawerContent>
      </Drawer>
    </>
  );
}
