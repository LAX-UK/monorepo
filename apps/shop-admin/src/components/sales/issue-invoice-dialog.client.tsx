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
      `Invoice for ${sale.artworkTitle} sent to ${body.buyerEmail}`,
    );
    if (ok) onOpenChange(false);
  });

  return (
    <>
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
