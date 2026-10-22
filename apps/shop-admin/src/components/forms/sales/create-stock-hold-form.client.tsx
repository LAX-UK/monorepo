"use client";

import { useAdminMutation } from "@/components/use-admin-mutation";
import {
  type FieldErrors,
  collectFieldErrors,
  hasFieldErrors,
  requiredText,
} from "@/lib/form-validation";
import { createStockHold } from "@/server/application/admin-sales-actions.server";
import { instantFromDatetimeFormString } from "@auction/ui";
import { useState } from "react";
import { AdminForm } from "../admin-form";
import { DateTimeField, TextField } from "../fields";

export function CreateStockHoldForm() {
  const mutation = useAdminMutation();
  const [editionId, setEditionId] = useState("");
  const [clientPartyId, setClientPartyId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  return (
    <AdminForm
      title="Create stock hold"
      mutation={mutation}
      errors={errors}
      submitLabel="Create hold"
      onSubmit={() => {
        const next = collectFieldErrors({
          editionId: requiredText(editionId, "Enter the edition ID."),
          clientPartyId: requiredText(clientPartyId, "Enter the client party ID."),
          expiresAt: requiredText(expiresAt, "Choose when the hold expires."),
        });
        setErrors(next);
        if (hasFieldErrors(next)) return;
        void mutation.run(
          () =>
            createStockHold({
              editionId: editionId.trim(),
              clientPartyId: clientPartyId.trim(),
              expiresAt: instantFromDatetimeFormString(expiresAt).toISOString(),
              ...(note.trim() ? { note: note.trim() } : {}),
              idempotencyKey: mutation.idempotencyKey,
            }),
          "Hold created",
        );
      }}
    >
      <TextField
        name="editionId"
        label="Edition ID"
        value={editionId}
        error={errors.editionId}
        disabled={mutation.pending}
        onChange={setEditionId}
      />
      <TextField
        name="clientPartyId"
        label="Client party ID"
        value={clientPartyId}
        error={errors.clientPartyId}
        disabled={mutation.pending}
        onChange={setClientPartyId}
      />
      <DateTimeField
        name="expiresAt"
        label="Expires at"
        value={expiresAt}
        error={errors.expiresAt}
        disabled={mutation.pending}
        onChange={setExpiresAt}
      />
      <TextField
        name="note"
        label="Note (optional)"
        value={note}
        disabled={mutation.pending}
        onChange={setNote}
      />
    </AdminForm>
  );
}
