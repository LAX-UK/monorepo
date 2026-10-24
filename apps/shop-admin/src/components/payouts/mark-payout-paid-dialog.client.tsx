"use client";

import { StaffFormDialog } from "@/components/staff-form-dialog";
import { StaffMutationError } from "@/components/staff-mutation-error";
import { useAdminMutation } from "@/components/use-admin-mutation";
import { markPayoutPaid } from "@/server/application/admin-operations-actions.server";
import {
  PAYOUT_PAID_REFERENCE_LIMIT,
  type PayoutRow,
  checkPaidReference,
  markPaidConfirmLabel,
  markPaidTitle,
  payoutReference,
  payoutSourceLabel,
} from "@/server/domain/payout-list.vm";
import { Field, KeyValueList, TextInput, formatGbp, formatStaffDate } from "@auction/staff-ui";
import { useRef, useState } from "react";

/**
 * Confirms a payout as paid. It names the payee, the amount and the payout's reference, asks for
 * the reference of the transfer that paid it, and the button repeats the amount. Money leaves the
 * business, so the API asks for a recent sign-in; if it is missing the dialog says so and offers
 * the way back in. The same request keeps its idempotency key until it succeeds.
 */
export function MarkPayoutPaidDialog({
  payout,
  open,
  onOpenChange,
}: {
  payout: PayoutRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mutation = useAdminMutation();
  const referenceRef = useRef<HTMLInputElement>(null);
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const live = submitted ? checkPaidReference(reference) : null;
  const shownError = live ? (live.ok ? null : live.message) : error;

  const reset = () => {
    setReference("");
    setError(null);
    setSubmitted(false);
  };

  const submit = async () => {
    setSubmitted(true);
    const checked = checkPaidReference(reference);
    if (!checked.ok) {
      setError(checked.message);
      referenceRef.current?.focus();
      return;
    }
    setError(null);
    const ok = await mutation.run(
      () =>
        markPayoutPaid({
          payoutId: payout.payoutId,
          paidReference: checked.value,
          idempotencyKey: mutation.idempotencyKey,
        }),
      `Payout to ${payout.ownerDisplayName} marked paid`,
    );
    if (ok) {
      reset();
      onOpenChange(false);
    }
  };

  return (
    <StaffFormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title={markPaidTitle(payout)}
      description="Do this once the transfer has left the bank. It cannot be undone."
      submitLabel={markPaidConfirmLabel(payout)}
      pending={mutation.pending}
      onSubmit={() => void submit()}
      initialFocusRef={referenceRef}
    >
      <KeyValueList
        items={[
          { label: "Payee", value: payout.ownerDisplayName },
          { label: "Amount", value: formatGbp(payout.netPence), numeric: true },
          {
            label: "Payout reference",
            value: payoutReference(payout.payoutId),
            copyValue: payout.payoutId,
          },
          { label: "Source", value: payoutSourceLabel(payout.source) },
          { label: "Due", value: formatStaffDate(payout.payoutDueAt) },
        ]}
      />
      <StaffMutationError mutation={mutation} />
      <Field
        label="Paid reference"
        description="The bank or transfer reference, kept with the payout."
        error={shownError}
      >
        <TextInput
          ref={referenceRef}
          value={reference}
          maxLength={PAYOUT_PAID_REFERENCE_LIMIT}
          autoComplete="off"
          onChange={(event) => setReference(event.target.value)}
        />
      </Field>
    </StaffFormDialog>
  );
}
