"use client";

import { useAdminMutation } from "@/components/use-admin-mutation";
import {
  type FieldErrors,
  collectFieldErrors,
  hasFieldErrors,
  requiredText,
} from "@/lib/form-validation";
import { updateFulfilment } from "@/server/application/admin-operations-actions.server";
import { useState } from "react";
import { AdminForm } from "../admin-form";
import { TextField } from "../fields";

export function UpdateFulfilmentForm({ defaultFulfilmentId }: { defaultFulfilmentId?: string }) {
  const mutation = useAdminMutation();
  const [fulfilmentId, setFulfilmentId] = useState(defaultFulfilmentId ?? "");
  const [status, setStatus] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  return (
    <AdminForm
      title="Update fulfilment"
      mutation={mutation}
      errors={errors}
      submitLabel="Update"
      onSubmit={() => {
        const next = collectFieldErrors({
          fulfilmentId: requiredText(fulfilmentId, "Enter the fulfilment ID."),
          status: requiredText(status, "Enter the new status."),
        });
        setErrors(next);
        if (hasFieldErrors(next)) return;
        void mutation.run(
          () =>
            updateFulfilment({
              fulfilmentId: fulfilmentId.trim(),
              status: status.trim(),
              ...(carrier.trim() ? { carrier: carrier.trim() } : {}),
              ...(trackingNumber.trim() ? { trackingNumber: trackingNumber.trim() } : {}),
              idempotencyKey: mutation.idempotencyKey,
            }),
          "Fulfilment updated",
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
      <TextField
        name="carrier"
        label="Carrier (optional)"
        value={carrier}
        disabled={mutation.pending}
        onChange={setCarrier}
      />
      <TextField
        name="trackingNumber"
        label="Tracking number (optional)"
        value={trackingNumber}
        disabled={mutation.pending}
        onChange={setTrackingNumber}
      />
    </AdminForm>
  );
}
