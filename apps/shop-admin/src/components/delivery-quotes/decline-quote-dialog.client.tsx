"use client";

import { StaffFormDialog } from "@/components/staff-form-dialog";
import { useAdminAction } from "@/components/use-admin-action.client";
import { QUOTE_DECLINE_NOTE_MAX_LENGTH, checkDeclineNote } from "@/lib/delivery-quotes";
import type { declineDeliveryQuote } from "@/server/application/delivery-quote-actions.server";
import type { AdminDeliveryQuote } from "@auction/shop-contracts";
import { Field, TextArea } from "@auction/staff-ui";
import { useId, useState } from "react";

/**
 * Say the gallery cannot deliver there. The buyer is emailed the reason, the print is released and
 * the basket is returned. One field, so a failed save shows its sentence beside the field only.
 */
export function DeclineQuoteDialog({
  request,
  open,
  onOpenChange,
  decline,
}: {
  request: AdminDeliveryQuote;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  decline: typeof declineDeliveryQuote;
}) {
  const action = useAdminAction();
  const fieldId = useId();
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const error = submitted ? checkDeclineNote(note) : null;

  const submit = async () => {
    setSubmitted(true);
    if (checkDeclineNote(note)) return;
    const ok = await action.run(
      () => decline({ quoteId: request.id, note, idempotencyKey: action.idempotencyKey }),
      `${request.orderReference} turned down`,
      "turn down a delivery quote",
    );
    if (ok) onOpenChange(false);
  };

  return (
    <>
      <StaffFormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={`We can't deliver ${request.orderReference}`}
        description="The buyer is emailed your reason and nothing is charged. The print is released and their basket is returned, with collection from London as the other choice."
        submitLabel="Turn down request"
        pending={action.pending}
        onSubmit={() => void submit()}
        size="md"
      >
        {action.error}
        <Field
          id={fieldId}
          label={`Why can't we deliver to ${request.countryName}?`}
          description="The buyer reads this as you write it."
          error={error ?? undefined}
        >
          <TextArea
            rows={4}
            maxLength={QUOTE_DECLINE_NOTE_MAX_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
      </StaffFormDialog>
      {action.stepUpDialog}
    </>
  );
}
