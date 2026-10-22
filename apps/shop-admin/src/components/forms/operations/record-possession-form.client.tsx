"use client";

import { useAdminMutation } from "@/components/use-admin-mutation";
import {
  type FieldErrors,
  collectFieldErrors,
  hasFieldErrors,
  requiredText,
} from "@/lib/form-validation";
import { recordFulfilmentPossession } from "@/server/application/admin-operations-actions.server";
import { instantFromDatetimeFormString } from "@auction/ui";
import { useState } from "react";
import { AdminForm } from "../admin-form";
import { DateTimeField, TextField } from "../fields";

export function RecordPossessionForm({ defaultFulfilmentId }: { defaultFulfilmentId?: string }) {
  const mutation = useAdminMutation();
  const [fulfilmentId, setFulfilmentId] = useState(defaultFulfilmentId ?? "");
  const [status, setStatus] = useState("");
  const [possessionAt, setPossessionAt] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  return (
    <AdminForm
      title="Record possession"
      mutation={mutation}
      errors={errors}
      submitLabel="Record possession"
      onSubmit={() => {
        const next = collectFieldErrors({
          fulfilmentId: requiredText(fulfilmentId, "Enter the fulfilment ID."),
          status: requiredText(status, "Enter the new status."),
          possessionAt: requiredText(possessionAt, "Choose when the customer took possession."),
        });
        setErrors(next);
        if (hasFieldErrors(next)) return;
        void mutation.run(
          () =>
            recordFulfilmentPossession({
              fulfilmentId: fulfilmentId.trim(),
              status: status.trim(),
              possessionAt: instantFromDatetimeFormString(possessionAt).toISOString(),
              idempotencyKey: mutation.idempotencyKey,
            }),
          "Possession recorded",
        );
      }}
    >
      <TextField
        name="fulfilmentId"
        label="Fulfilment ID"
        value={fulfilmentId}
        error={errors.fulfilmentId}
        disabled={mutation.pending}
        onChange={setFulfilmentId}
      />
      <TextField
        name="status"
        label="Status"
        value={status}
        error={errors.status}
        disabled={mutation.pending}
        onChange={setStatus}
      />
      <DateTimeField
        name="possessionAt"
        label="Possession at"
        value={possessionAt}
        error={errors.possessionAt}
        disabled={mutation.pending}
        onChange={setPossessionAt}
      />
    </AdminForm>
  );
}
