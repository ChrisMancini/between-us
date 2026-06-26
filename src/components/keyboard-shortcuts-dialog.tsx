"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1.5 font-mono text-[11px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

function ShortcutRow({
  keys,
  label,
}: {
  keys: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-foreground">{label}</span>
      <div className="flex items-center gap-1">{keys}</div>
    </div>
  );
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  if (!open) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Navigation
            </h3>
            <div className="divide-y divide-border">
              <ShortcutRow
                keys={<><Kbd>g</Kbd><Kbd>d</Kbd></>}
                label="Dashboard"
              />
              <ShortcutRow
                keys={<><Kbd>g</Kbd><Kbd>e</Kbd></>}
                label="Expenses"
              />
              <ShortcutRow
                keys={<><Kbd>g</Kbd><Kbd>r</Kbd></>}
                label="Reports"
              />
              <ShortcutRow
                keys={<><Kbd>g</Kbd><Kbd>s</Kbd></>}
                label="Settlement"
              />
              <ShortcutRow
                keys={<><Kbd>g</Kbd><Kbd>a</Kbd></>}
                label="Activity"
              />
              <ShortcutRow
                keys={<><Kbd>g</Kbd><Kbd>t</Kbd></>}
                label="Recurring"
              />
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Actions
            </h3>
            <div className="divide-y divide-border">
              <ShortcutRow
                keys={<Kbd>n</Kbd>}
                label="New expense"
              />
              <ShortcutRow
                keys={<Kbd>?</Kbd>}
                label="Show shortcuts"
              />
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
