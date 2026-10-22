"use client";

import { useAdminMutation } from "@/components/use-admin-mutation";
import {
  type FieldErrors,
  collectFieldErrors,
  hasFieldErrors,
  parseWholeNumber,
  requiredText,
} from "@/lib/form-validation";
import { recordThirdPartySale } from "@/server/application/admin-sales-actions.server";
import { useState } from "react";
import { AdminForm } from "../admin-form";
import { TextField } from "../fields";

export function RecordThirdPartySaleForm() {
  const mutation = useAdminMutation();
  const [editionId, setEditionId] = useState("");
  const [sellerPartyId, setSellerPartyId] = useState("");
  const [buyerPartyId, setBuyerPartyId] = useState("");
  const [grossPence, setGrossPence] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  return (
    <AdminForm
      title="Record third-party sale"
      mutation={mutation}
      errors={errors}
      submitLabel="Record sale"
      onSubmit={() => {
        const gross = parseWholeNumber(grossPence, { min: 0 }, "Enter the gross amount in pence.");
        const next = collectFieldErrors({
          editionId: requiredText(editionId, "Enter the edition ID."),
          sellerPartyId: requiredText(sellerPartyId, "Enter the seller party ID."),
          buyerPartyId: requiredText(buyerPartyId, "Enter the buyer party ID."),
          grossPence: gross.ok ? null : gross.message,
        });
        setErrors(next);
        if (hasFieldErrors(next) || !gross.ok) return;
        void mutation.run(
          () =>
            recordThirdPartySale({
              editionId: editionId.trim(),
              sellerPartyId: sellerPartyId.trim(),
              buyerPartyId: buyerPartyId.trim(),
              grossPence: gross.value,
              idempotencyKey: mutation.idempotencyKey,
            }),
          "Sale recorded",
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
        name="sellerPartyId"
        label="Seller party ID"
        value={sellerPartyId}
        error={errors.sellerPartyId}
        disabled={mutation.pending}
        onChange={setSellerPartyId}
      />
      <TextField
        name="buyerPartyId"
        label="Buyer party ID"
        value={buyerPartyId}
        error={errors.buyerPartyId}
        disabled={mutation.pending}
        onChange={setBuyerPartyId}
      />
      <TextField
        name="grossPence"
        label="Gross (pence)"
        type="number"
        min={0}
        value={grossPence}
        error={errors.grossPence}
        disabled={mutation.pending}
        onChange={setGrossPence}
      />
    </AdminForm>
  );
}
