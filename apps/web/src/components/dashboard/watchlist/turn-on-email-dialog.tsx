"use client";

import { othersConfirmationText } from "@/lib/watching/search-email";
import { Button } from "@auction/ui/lax/button";
import { Dialog } from "@auction/ui/lax/dialog";

/**
 * Asked before turning on one saved search's email brings other searches' email back with it:
 * they already had their own switch on, and were waiting for saved-search alerts to be on.
 */
export function TurnOnEmailDialog({
  open,
  othersOn,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  othersOn: number;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel();
      }}
      title="Turn on email?"
      description={othersConfirmationText(othersOn)}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={onConfirm}>
            Turn on
          </Button>
        </>
      }
    />
  );
}
