"use client";

import { useAdminMutation } from "@/components/use-admin-mutation";
import {
  type FieldErrors,
  collectFieldErrors,
  hasFieldErrors,
  parseWholeNumber,
  requiredText,
} from "@/lib/form-validation";
import { createOriginalSale } from "@/server/application/admin-sales-actions.server";
import { instantFromDatetimeFormString } from "@auction/ui";
import { useState } from "react";
import { AdminForm } from "../admin-form";
import { DateTimeField, TextField } from "../fields";

export function CreateOriginalSaleForm() {
  const mutation = useAdminMutation();
  const [artworkId, setArtworkId] = useState("");
  const [buyerPartyId, setBuyerPartyId] = useState("");
  const [salePricePence, setSalePricePence] = useState("");
  const [reservationExpiresAt, setReservationExpiresAt] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  return (
    <AdminForm
      title="Create original sale reservation"
      mutation={mutation}
      errors={errors}
      submitLabel="Create reservation"
      onSubmit={() => {
        const price = parseWholeNumber(
          salePricePence,
          { min: 0 },
          "Enter the sale price in pence.",
        );
        const next = collectFieldErrors({
          artworkId: requiredText(artworkId, "Enter the artwork ID."),
          buyerPartyId: requiredText(buyerPartyId, "Enter the buyer party ID."),
          salePricePence: price.ok ? null : price.message,
        });
        setErrors(next);
        if (hasFieldErrors(next) || !price.ok) return;
        void mutation.run(
          () =>
            createOriginalSale({
              artworkId: artworkId.trim(),
              buyerPartyId: buyerPartyId.trim(),
              salePricePence: price.value,
              ...(reservationExpiresAt
                ? {
                    reservationExpiresAt:
                      instantFromDatetimeFormString(reservationExpiresAt).toISOString(),
                  }
                : {}),
              idempotencyKey: mutation.idempotencyKey,
            }),
          "Original sale created",
        );
      }}
    >
      <TextField
        name="artworkId"
        label="Artwork ID"
        value={artworkId}
        error={errors.artworkId}
        disabled={mutation.pending}
        onChange={setArtworkId}
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
        name="salePricePence"
        label="Sale price (pence)"
        type="number"
        min={0}
        value={salePricePence}
        error={errors.salePricePence}
        disabled={mutation.pending}
        onChange={setSalePricePence}
      />
      <DateTimeField
        name="reservationExpiresAt"
        label="Reservation expires (optional)"
        value={reservationExpiresAt}
        disabled={mutation.pending}
        onChange={setReservationExpiresAt}
      />
    </AdminForm>
  );
}
