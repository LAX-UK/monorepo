"use client";

import { checkResolver } from "@/components/sales/sales-form";
import { StaffFormDialog } from "@/components/staff-form-dialog";
import { useAdminAction } from "@/components/use-admin-action.client";
import { issueOriginalSaleInvoice } from "@/server/application/admin-sales-actions.server";
import {
  INVOICE_BUYER_NAME_MAX_LENGTH,
  type OriginalSaleRow,
  checkInvoiceDetails,
} from "@/server/domain/sales-records.vm";
import { Field, KeyValueList, TextInput, formatStaffMoney } from "@auction/staff-ui";
import { useForm } from "react-hook-form";

type InvoiceValues = { buyerEmail: string; buyerName: string };

/**
 * Issue the invoice for a reserved original. The buyer's name and email come from their record;
 * change them only if the invoice should go elsewhere. Stripe emails its invoice to that address,
 * unless the Shop is invoiced by Zoho Books live: then nothing is emailed now, staff send the buyer
 * the payment link, and Books emails its invoice there once they have paid. What was sent is said
 * from the server's answer, never assumed. The sale is assigned to the buyer once they pay.
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
  const mutation = useAdminAction();
  const form = useForm<InvoiceValues>({
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { buyerEmail: sale.buyerEmail ?? "", buyerName: sale.buyerName ?? "" },
    resolver: checkResolver(checkInvoiceDetails),
  });
  const { errors } = form.formState;
  const amount = formatStaffMoney(sale.salePricePence);

  const submit = form.handleSubmit(async (values) => {
    const checked = checkInvoiceDetails(values);
    if (!checked.ok) return;
    const body = checked.body;
    const ok = await mutation.run(
      () =>
        issueOriginalSaleInvoice({
          originalSaleId: sale.saleId,
          ...body,
          idempotencyKey: mutation.idempotencyKey,
        }),
      (issued) => issuedMessage(sale.artworkTitle, body.buyerEmail, issued),
    );
    if (ok) onOpenChange(false);
  });

  return (
    <>
      <StaffFormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={`Invoice ${amount} for ${sale.artworkTitle}?`}
        description="The buyer is sent the invoice, or given a payment link to send them if the Shop is invoiced by Zoho Books. The original is assigned to them as soon as they pay."
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
        {mutation.error}
        <Field label="Send the invoice to" error={errors.buyerEmail?.message}>
          <TextInput type="email" autoComplete="off" {...form.register("buyerEmail")} />
        </Field>
        <Field label="Name on the invoice" optional error={errors.buyerName?.message}>
          <TextInput maxLength={INVOICE_BUYER_NAME_MAX_LENGTH} {...form.register("buyerName")} />
        </Field>
      </StaffFormDialog>
      {mutation.stepUpDialog}
    </>
  );
}

/** What was sent, as the server says it issued the invoice. */
export function issuedMessage(
  artworkTitle: string,
  buyerEmail: string,
  issued: { invoiceIssuer: "stripe" | "books"; hostedInvoiceUrl: string | null },
): string {
  if (issued.invoiceIssuer === "stripe") {
    return `Stripe emailed the invoice for ${artworkTitle} to ${buyerEmail}`;
  }
  const link = issued.hostedInvoiceUrl ?? "the payment link in Stripe";
  return `Nothing was emailed. Send ${buyerEmail} this payment link for ${artworkTitle}: ${link}. Zoho Books emails the invoice to them once they have paid.`;
}
