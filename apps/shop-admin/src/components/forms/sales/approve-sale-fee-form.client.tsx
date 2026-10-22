"use client";

import { useAdminMutation } from "@/components/use-admin-mutation";
import {
  type FieldErrors,
  collectFieldErrors,
  hasFieldErrors,
  requiredText,
} from "@/lib/form-validation";
import { approveSaleFee } from "@/server/application/admin-sales-actions.server";
import { ConfirmDialog } from "@auction/ui";
import { useState } from "react";
import { AdminForm } from "../admin-form";
import { TextField } from "../fields";

export function ApproveSaleFeeForm() {
  const mutation = useAdminMutation();
  const [feeId, setFeeId] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <AdminForm
        title="Approve sale fee"
        mutation={mutation}
        errors={errors}
        submitLabel="Approve fee"
        onSubmit={() => {
          const next = collectFieldErrors({ feeId: requiredText(feeId, "Enter the fee ID.") });
          setErrors(next);
          if (!hasFieldErrors(next)) setConfirming(true);
        }}
      >
        <TextField
          name="feeId"
          label="Fee ID"
          value={feeId}
          error={errors.feeId}
          disabled={mutation.pending}
          onChange={setFeeId}
        />
      </AdminForm>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Approve fee ${feeId.trim().slice(0, 8)}`}
        body="The fee is approved for the sale. An approved fee cannot be changed or withdrawn from LAX Admin."
        confirmLabel="Approve fee"
        tone="warning"
        loading={mutation.pending}
        onConfirm={async () => {
          await mutation.run(
            () => approveSaleFee({ feeId: feeId.trim(), idempotencyKey: mutation.idempotencyKey }),
            "Fee approved",
          );
          setConfirming(false);
        }}
      />
    </>
  );
}
