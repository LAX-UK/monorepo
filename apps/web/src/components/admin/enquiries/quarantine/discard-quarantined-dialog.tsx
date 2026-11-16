"use client";

import { QUARANTINE_COPY } from "@/lib/admin/enquiries/enquiry-email-copy";
import { ConfirmActionDialog, Notice } from "@auction/staff-ui";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  failure: string | null;
  onDiscard: () => void;
};

/** Confirms discarding a held email: it stays off every enquiry until it is deleted. */
export function DiscardQuarantinedDialog({ open, onOpenChange, busy, failure, onDiscard }: Props) {
  const copy = QUARANTINE_COPY.discard;
  return (
    <ConfirmActionDialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
      title={copy.title}
      description={copy.description}
      confirmLabel={copy.confirm}
      cancelLabel={QUARANTINE_COPY.attach.cancel}
      tone="danger"
      loading={busy}
      onConfirm={onDiscard}
    >
      {failure ? (
        <Notice tone="danger" alert title="That did not go through">
          {failure}
        </Notice>
      ) : null}
    </ConfirmActionDialog>
  );
}
