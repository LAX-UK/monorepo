"use client";

import type { SwapTarget } from "@/components/orders/confirm-print-dialog.client";
import { useAdminAction } from "@/components/use-admin-action.client";
import { swapPrint } from "@/server/application/print-fulfilment-actions.server";
import type { PackRowView } from "@/server/domain/pick-and-pack.vm";
import { swapReasonError } from "@/server/domain/pick-and-pack.vm";
import { SWAP_REASON_FIELD_MAX } from "@auction/shop-contracts";
import { Field, StaffButton, StaffDialog, TextArea } from "@auction/staff-ui";
import { useId, useRef, useState } from "react";

/**
 * Sends another print in place of the one sold, because it is missing or damaged. The print sold
 * is set aside with the reason given. Left without a target, the next free print is chosen: the
 * same owner's lowest number first, so the payout does not change. The reason is the only field,
 * so a missing one is shown against it and nowhere else.
 */
export function SwapPrintDialog({
  row,
  target,
  open,
  onOpenChange,
}: {
  row: PackRowView;
  target: SwapTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const action = useAdminAction();
  const formId = useId();
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const [reason, setReason] = useState("");
  const [attempted, setAttempted] = useState(false);
  const error = attempted ? swapReasonError(reason) : null;
  const sends = target ? `Send ${target.label}` : "Send the next free print";

  const submit = async () => {
    setAttempted(true);
    if (swapReasonError(reason)) return;
    const ok = await action.run(
      () =>
        swapPrint({
          orderLineId: row.orderLineId,
          body: { reason: reason.trim(), ...(target ? { toEditionId: target.editionId } : {}) },
          idempotencyKey: action.idempotencyKey,
        }),
      target
        ? `${target.label} will be sent instead of ${row.label}`
        : "Another print will be sent",
    );
    if (ok) {
      setReason("");
      setAttempted(false);
      onOpenChange(false);
    }
  };

  return (
    <StaffDialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      initialFocusRef={reasonRef}
      title={`Replace ${row.label}`}
      description={
        target
          ? `${row.label} is set aside and ${target.label} is sent instead. A numbered print means the buyer is emailed the new number.`
          : `${row.label} is set aside and the next free print is sent instead. A numbered print means the buyer is emailed the new number.`
      }
      footer={
        <>
          <StaffButton
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={action.pending}
          >
            Cancel
          </StaffButton>
          <StaffButton variant="primary" type="submit" form={formId} loading={action.pending}>
            {sends}
          </StaffButton>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {action.error}
        <Field
          id={`${formId}-reason`}
          label="Why is it being replaced?"
          description="Kept on the print's record, for staff."
          error={error ?? undefined}
        >
          <TextArea
            ref={reasonRef}
            rows={3}
            maxLength={SWAP_REASON_FIELD_MAX}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
      </form>
    </StaffDialog>
  );
}
