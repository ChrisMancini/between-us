"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { OPEN_QUICK_ENTRY_EVENT } from "@/hooks/use-hotkeys";
import type { SerializedTag } from "@/lib/models/tag";
import { QuickEntryForm } from "./quick-entry-form";

interface QuickEntryFabProps {
  paidBy: string;
}

export function QuickEntryFab({ paidBy }: QuickEntryFabProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const [tags, setTags] = useState<SerializedTag[]>([]);
  const [recentTagIds, setRecentTagIds] = useState<string[]>([]);
  const fetchedRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const [tagsRes, recentRes] = await Promise.all([
      fetch("/api/tags"),
      fetch("/api/tags/recent"),
    ]);

    if (tagsRes.ok) {
      const data = await tagsRes.json();
      setTags(data.tags);
    }
    if (recentRes.ok) {
      const data = await recentRes.json();
      setRecentTagIds(data.tagIds);
    }
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) fetchData();
    setOpen(nextOpen);
  }

  useEffect(() => {
    function handleQuickEntry() {
      fetchData();
      setOpen(true);
    }

    window.addEventListener(OPEN_QUICK_ENTRY_EVENT, handleQuickEntry);
    return () =>
      window.removeEventListener(OPEN_QUICK_ENTRY_EVENT, handleQuickEntry);
  }, [fetchData]);

  function handleTagCreated(tag: SerializedTag) {
    setTags((prev) => [...prev, tag]);
  }

  if (pathname.startsWith("/admin")) return null;

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon"
                className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg"
                onClick={() => handleOpenChange(true)}
              />
            }
          >
            <Plus className="h-6 w-6" />
          </TooltipTrigger>
          <TooltipContent side="left">
            Quick add expense (n)
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Drawer open={open} onOpenChange={handleOpenChange} showSwipeHandle>
        <DrawerContent>
          <div className="mx-auto w-full max-w-sm overflow-y-auto p-4">
            <DrawerHeader className="px-0">
              <DrawerTitle>Quick Add Expense</DrawerTitle>
              <DrawerDescription>
                50/50 split, deferred settlement. Use the full form for other options.
              </DrawerDescription>
            </DrawerHeader>
            <div className="pt-4 pb-2">
              <QuickEntryForm
                paidBy={paidBy}
                tags={tags}
                recentTagIds={recentTagIds}
                onClose={() => setOpen(false)}
                onTagCreated={handleTagCreated}
              />
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
