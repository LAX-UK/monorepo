"use client";

import { StaffFormDialog } from "@/components/staff-form-dialog";
import { StaffMutationError } from "@/components/staff-mutation-error";
import { useAdminMutation } from "@/components/use-admin-mutation";
import { issueOriginalSaleInvoice } from "@/server/application/admin-sales-actions.server";
import {
  INVOICE_BUYER_NAME_MAX_LENGTH,
  type OriginalSaleRow,
  checkInvoiceDetails,
} from "@/server/domain/sales-records.vm";
import { Field, KeyValueList, TextInput, formatGbp } from "@auction/staff-ui";
import { useState } from "react";

/**
 * Issue the Stripe invoice for a reserved original. The buyer's name and email come from their
 * record; change them only if the invoice should go elsewhere. The sale is assigned to the buyer
 * automatically once Stripe reports the invoice paid.
 */
export function IssueInvoiceDialog({
  sale,
  open,
  onOpenChange,
}: {
  sale: OriginalSaleRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const mutation = useAdminMutation();
  const [buyerEmail, setBuyerEmail] = useState(sale.buyerEmail ?? "");
  const [buyerName, setBuyerName] = useState(sale.buyerName ?? "");
  const [submits, setSubmits] = useState(0);

  const checked = checkInvoiceDetails({ buyerEmail, buyerName });
  const errors = submits > 0 && !checked.ok ? checked.errors : {};
  const amount = formatGbp(sale.salePricePence);

  const submit = async () => {
    setSubmits((count) => count + 1);
    if (!checked.ok) return;
    const body = checked.body;
    const ok = await mutation.run(
      () =>
        issueOriginalSaleInvoice({
          originalSaleId: sale.saleId,
          ...body,
          idempotencyKey: mutation.idempotencyKey,
        }),
      `Invoice for ${sale.artworkTitle} sent to ${body.buyerEmail}`,
    );
    if (ok) onOpenChange(false);
  };

  return (
    <StaffFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Invoice ${amount} for ${sale.artworkTitle}?`}
      description="Stripe emails the invoice to the buyer. The original is assigned to them as soon as they pay."
      submitLabel={`Issue ${amount} invoice`}
      pending={mutation.pending}
      onSubmit={() => void submit()}
    >
      <KeyValueList
        items={[
          { label: "Artwork", value: sale.artworkTitle },
          { label: "Buyer", value: sale.buyerName ?? null },
          { label: "Amount", value: amount, numeric: true },
        ]}
      />
      <StaffMutationError mutation={mutation} />
      <Field label="Send the invoice to" error={errors.buyerEmail}>
        <TextInput
          type="email"
          autoComplete="off"
          value={buyerEmail}
          onChange={(event) => setBuyerEmail(event.target.value)}
        />
      </Field>
      <Field label="Name on the invoice" optional error={errors.buyerName}>
        <TextInput
          value={buyerName}
          maxLength={INVOICE_BUYER_NAME_MAX_LENGTH}
          onChange={(event) => setBuyerName(event.target.value)}
        />
      </Field>
    </StaffFormDialog>
  );
}
