"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface SettlementNoteProps {
  month: number;
  year: number;
  note?: string;
  isClosed: boolean;
}

export function SettlementNote({ month, year, note, isClosed }: SettlementNoteProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settlement", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, year, note: draft }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to update note");
        return;
      }

      toast.success("Note updated");
      setEditing(false);
      router.refresh();
    } catch {
      toast.error("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(note ?? "");
    setEditing(false);
  }

  if (!isClosed) {
    if (!note) return null;
    return (
      <p className="mt-2 text-sm text-muted-foreground italic">{note}</p>
    );
  }

  if (editing) {
    return (
      <div className="mt-2 space-y-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g., Paid via Zelle"
          rows={2}
          className="resize-none text-sm"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Escape") handleCancel();
          }}
        />
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (note) {
    return (
      <div className="mt-2 flex items-start gap-1.5 group">
        <p className="text-sm text-muted-foreground italic">{note}</p>
        <button
          onClick={() => setEditing(true)}
          className="focus-ring opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
          aria-label="Edit note"
        >
          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="focus-ring mt-2 inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <Plus className="h-3.5 w-3.5" />
      Add payment note
    </button>
  );
}
