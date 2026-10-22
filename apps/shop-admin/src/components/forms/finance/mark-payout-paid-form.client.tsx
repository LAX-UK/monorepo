"use client";

import { useAdminMutation } from "@/components/use-admin-mutation";
import {
  type FieldErrors,
  collectFieldErrors,
  hasFieldErrors,
  requiredText,
} from "@/lib/form-validation";
import { markPayoutPaid } from "@/server/application/admin-operations-actions.server";
import { ConfirmDialog } from "@auction/ui";
import { useState } from "react";
import { AdminForm } from "../admin-form";
import { TextField } from "../fields";

export function MarkPayoutPaidForm({ defaultPayoutId }: { defaultPayoutId?: string }) {
  const mutation = useAdminMutation();
  const [payoutId, setPayoutId] = useState(defaultPayoutId ?? "");
  const [paidReference, setPaidReference] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <AdminForm
        title="Mark payout paid"
        mutation={mutation}
        errors={errors}
        submitLabel="Mark paid"
        onSubmit={() => {
          const next = collectFieldErrors({
            payoutId: requiredText(payoutId, "Enter the payout ID."),
            paidReference: requiredText(paidReference, "Enter the paid reference."),
          });
          setErrors(next);
          if (!hasFieldErrors(next)) setConfirming(true);
        }}
      >
        <TextField
          name="payoutId"
          label="Payout ID"
          value={payoutId}
          error={errors.payoutId}
          disabled={mutation.pending}
          onChange={setPayoutId}
        />
        <TextField
          name="paidReference"
          label="Paid reference"
          value={paidReference}
          error={errors.paidReference}
          disabled={mutation.pending}
          onChange={setPaidReference}
        />
      </AdminForm>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Mark payout ${payoutId.trim().slice(0, 8)} paid`}
        body={`The payout is recorded as paid with reference "${paidReference.trim()}". This cannot be undone.`}
        confirmLabel="Mark paid"
        tone="warning"
        loading={mutation.pending}
        onConfirm={async () => {
          await mutation.run(
            () =>
              markPayoutPaid({
                payoutId: payoutId.trim(),
                paidReference: paidReference.trim(),
                idempotencyKey: mutation.idempotencyKey,
              }),
            "Payout marked paid",
          );
          setConfirming(false);
        }}
      />
    </>
  );
}
