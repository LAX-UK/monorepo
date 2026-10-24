"use client";

import { EditionPicker, PartyPicker } from "@/components/pickers/record-pickers.client";
import { StaffFormDialog } from "@/components/staff-form-dialog";
import { StaffMutationError } from "@/components/staff-mutation-error";
import { useAdminMutation } from "@/components/use-admin-mutation";
import { recordThirdPartySale } from "@/server/application/admin-sales-actions.server";
import type { LookupOption } from "@/server/domain/lookup-options.vm";
import { checkThirdPartySale } from "@/server/domain/sales-records.vm";
import { Field, MoneyInput, formatGbp } from "@auction/staff-ui";
import { useState } from "react";

/**
 * Record a sale made outside the shop: the edition, who sold it, who bought it and what the buyer
 * paid, in pounds. All three records are chosen by name.
 */
export function RecordThirdPartySaleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mutation = useAdminMutation();
  const [edition, setEdition] = useState<LookupOption | null>(null);
  const [seller, setSeller] = useState<LookupOption | null>(null);
  const [buyer, setBuyer] = useState<LookupOption | null>(null);
  const [grossPence, setGrossPence] = useState<number | null>(null);
  const [grossTyped, setGrossTyped] = useState(false);
  const [submits, setSubmits] = useState(0);

  const checked = checkThirdPartySale({ edition, seller, buyer, grossPence, grossTyped });
  const errors = submits > 0 && !checked.ok ? checked.errors : {};

  const submit = async () => {
    setSubmits((count) => count + 1);
    if (!checked.ok) return;
    const body = checked.body;
    const ok = await mutation.run(
      () => recordThirdPartySale({ ...body, idempotencyKey: mutation.idempotencyKey }),
      `Sale of ${edition?.label ?? "the edition"} recorded for ${formatGbp(body.grossPence)}`,
    );
    if (ok) onOpenChange(false);
  };

  return (
    <StaffFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Record a third-party sale"
      description="A sale made through a partner outside the shop. Finance approves its fee afterwards."
      submitLabel="Record sale"
      pending={mutation.pending}
      onSubmit={() => void submit()}
    >
      <StaffMutationError mutation={mutation} />
      <Field label="Edition" error={errors.edition}>
        <EditionPicker value={edition} onChange={setEdition} />
      </Field>
      <Field label="Seller" error={errors.seller}>
        <PartyPicker value={seller} onChange={setSeller} />
      </Field>
      <Field label="Buyer" error={errors.buyer}>
        <PartyPicker value={buyer} onChange={setBuyer} />
      </Field>
      <Field
        label="Amount the buyer paid"
        description="In pounds, before any fees."
        error={errors.gross}
      >
        <MoneyInput
          value={grossPence}
          onValueChange={setGrossPence}
          onInput={(event) => setGrossTyped(Boolean(event.currentTarget.value.trim()))}
          placeholder="0.00"
          boxClassName="max-w-48"
        />
      </Field>
    </StaffFormDialog>
  );
}
