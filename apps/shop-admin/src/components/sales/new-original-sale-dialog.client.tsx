"use client";

import { ArtworkPicker, PartyPicker } from "@/components/pickers/record-pickers.client";
import { StaffFormDialog } from "@/components/staff-form-dialog";
import { StaffMutationError } from "@/components/staff-mutation-error";
import { useAdminMutation } from "@/components/use-admin-mutation";
import { createOriginalSale } from "@/server/application/admin-sales-actions.server";
import type { LookupOption } from "@/server/domain/lookup-options.vm";
import { checkOriginalSale } from "@/server/domain/sales-records.vm";
import { DateTimeInput, Field, MoneyInput, formatGbp } from "@auction/staff-ui";
import { useState } from "react";

/**
 * Reserve the original of an artwork for a buyer at an agreed price, in pounds. An optional end
 * time releases the reservation if no invoice follows. The invoice is issued from the sale's row.
 */
export function NewOriginalSaleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mutation = useAdminMutation();
  const [artwork, setArtwork] = useState<LookupOption | null>(null);
  const [buyer, setBuyer] = useState<LookupOption | null>(null);
  const [pricePence, setPricePence] = useState<number | null>(null);
  const [priceTyped, setPriceTyped] = useState(false);
  const [reservationExpiresAt, setReservationExpiresAt] = useState<string | null>(null);
  const [submits, setSubmits] = useState(0);
  const [now] = useState(() => new Date());

  const checked = checkOriginalSale({
    artwork,
    buyer,
    pricePence,
    priceTyped,
    reservationExpiresAt,
    now,
  });
  const errors = submits > 0 && !checked.ok ? checked.errors : {};

  const submit = async () => {
    setSubmits((count) => count + 1);
    if (!checked.ok) return;
    const body = checked.body;
    const ok = await mutation.run(
      () => createOriginalSale({ ...body, idempotencyKey: mutation.idempotencyKey }),
      `${artwork?.label ?? "Original"} reserved for ${formatGbp(body.salePricePence)}`,
    );
    if (ok) onOpenChange(false);
  };

  return (
    <StaffFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Reserve an original"
      description="Reserve the original for a buyer, then issue their invoice from the sale. It is assigned to them once they pay."
      submitLabel="Reserve original"
      pending={mutation.pending}
      onSubmit={() => void submit()}
    >
      <StaffMutationError mutation={mutation} />
      <Field label="Artwork" error={errors.artwork}>
        <ArtworkPicker value={artwork} onChange={setArtwork} />
      </Field>
      <Field label="Buyer" error={errors.buyer}>
        <PartyPicker value={buyer} onChange={setBuyer} />
      </Field>
      <Field label="Sale price" description="In pounds." error={errors.price}>
        <MoneyInput
          value={pricePence}
          onValueChange={setPricePence}
          onInput={(event) => setPriceTyped(Boolean(event.currentTarget.value.trim()))}
          placeholder="0.00"
          boxClassName="max-w-48"
        />
      </Field>
      <Field
        label="Reservation ends"
        optional
        description="Leave empty to hold it until it is invoiced."
        error={errors.reservationExpiresAt}
      >
        <DateTimeInput
          value={reservationExpiresAt}
          onValueChange={setReservationExpiresAt}
          min={now.toISOString()}
        />
      </Field>
    </StaffFormDialog>
  );
}
