"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { ArrowLeftRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PersonBadge } from "@/components/person-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { SerializedPerson } from "@/types/person";

interface PeopleRolesProps {
  persons: SerializedPerson[];
}

export function PeopleRoles({ persons }: PeopleRolesProps) {
  const [open, setOpen] = useState(false);
  const [swapping, setSwapping] = useState(false);

  async function handleSwap() {
    setSwapping(true);
    try {
      const res = await fetch("/api/admin/people/swap-roles", {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Failed to swap roles");
        return;
      }
      toast.success("Roles swapped — signing you out…");
      setOpen(false);
      await signOut({ callbackUrl: "/login" });
    } finally {
      setSwapping(false);
    }
  }

  return (
    <div className="rounded-xl border border-primary/10 bg-card overflow-hidden shadow-sm">
      <div className="border-b border-primary/10 bg-primary/5 px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary/70">
          People &amp; Roles
        </p>
      </div>

      <div className="divide-y divide-border">
        {persons.map((p) => (
          <div key={p._id} className="flex items-center justify-between px-4 py-3">
            <PersonBadge
              personKey={p.key}
              displayName={p.displayName}
              colorIndex={p.colorIndex}
            />
            <Badge
              variant={p.role === "admin" ? "default" : "secondary"}
              className="text-xs"
            >
              {p.role === "admin" ? "Admin" : "User"}
            </Badge>
          </div>
        ))}
      </div>

      <div className="border-t border-border px-4 py-3">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button variant="outline" size="sm" disabled={swapping}>
                <ArrowLeftRight className="mr-2 h-3.5 w-3.5" />
                Swap Roles
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Swap Roles?</DialogTitle>
              <DialogDescription>
                This will make the current admin a regular user and vice versa.
                You will lose admin access and will no longer be able to manage
                settings.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={swapping}
              >
                Cancel
              </Button>
              <Button onClick={handleSwap} disabled={swapping}>
                {swapping ? "Swapping…" : "Swap Roles"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
