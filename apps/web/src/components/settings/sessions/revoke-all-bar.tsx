"use client";

import { Button } from "@auction/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@auction/ui/components/dialog";
import { useState } from "react";

export function RevokeAllBar({
  count,
  busy,
  onConfirm,
}: {
  count: number;
  busy: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  if (count <= 1) return null;

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={busy}
        onClick={() => setOpen(true)}
      >
        Revoke all {count} other sessions
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke all other sessions?</DialogTitle>
            <DialogDescription>
              You will be signed out on {count} other devices. This device stays signed in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  await onConfirm();
                  setOpen(false);
                })();
              }}
            >
              {busy ? "Revoking…" : "Revoke all"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
