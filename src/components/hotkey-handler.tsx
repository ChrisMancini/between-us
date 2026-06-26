"use client";

import { useHotkeys } from "@/hooks/use-hotkeys";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog";

export function HotkeyHandler() {
  const { shortcutsOpen, setShortcutsOpen } = useHotkeys();

  return (
    <KeyboardShortcutsDialog
      open={shortcutsOpen}
      onOpenChange={setShortcutsOpen}
    />
  );
}
