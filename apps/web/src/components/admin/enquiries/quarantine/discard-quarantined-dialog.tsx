"use client";

import { QUARANTINE_COPY } from "@/lib/admin/enquiries/enquiry-email-copy";
import { reviewReasonError, reviewReasonOf } from "@/lib/admin/enquiries/quarantine.vm";
import { ConfirmActionDialog, Field, Notice, TextArea } from "@auction/staff-ui";
import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  failure: string | null;
  onDiscard: (reason: string) => void;
};

/**
 * Confirms discarding a held email, with a reason kept in the audit trail: it stays off every
 * enquiry until it is deleted.
 */
export function DiscardQuarantinedDialog({ open, onOpenChange, busy, failure, onDiscard }: Props) {
  const copy = QUARANTINE_COPY.discard;
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason("");
    setTouched(false);
  }, [open]);

  const givenReason = reviewReasonOf(reason);
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
      confirmDisabled={!givenReason}
      onConfirm={() => {
        setTouched(true);
        if (givenReason) onDiscard(givenReason);
      }}
    >
      {failure ? (
        <Notice tone="danger" alert title={QUARANTINE_COPY.failureTitle}>
          {failure}
        </Notice>
      ) : null}
      <Field
        label={copy.reasonLabel}
        description={copy.reasonHint}
        error={touched ? reviewReasonError(reason) : null}
        disabled={busy}
      >
        <TextArea
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          onBlur={() => setTouched(true)}
        />
      </Field>
    </ConfirmActionDialog>
  );
}
