"use client";

import { StaffFormDialog } from "@/components/staff-form-dialog";
import { useAdminAction } from "@/components/use-admin-action.client";
import {
  QUOTE_CARRIER_MAX_LENGTH,
  QUOTE_FIELD_LABELS,
  QUOTE_LEAD_TIME_NOTE_MAX_LENGTH,
  QUOTE_SERVICE_MAX_LENGTH,
  type QuoteFormValues,
  checkQuoteForm,
  quoteFormValues,
  quotePrice,
} from "@/lib/delivery-quotes";
import type { sendDeliveryQuote } from "@/server/application/delivery-quote-actions.server";
import type { AdminDeliveryQuote } from "@auction/shop-contracts";
import type { DeliveryQuoteInputField } from "@auction/shop-domain";
import { Field, FormErrorSummary, MoneyInput, Notice, TextInput } from "@auction/staff-ui";
import { useId, useState } from "react";

/**
 * Send the buyer a delivery price. The price is for delivery with insurance included, because the
 * gallery insures the work and the buyer pays for it; duties abroad stay the buyer's and the email
 * and the order page say so. Two or more fields, so a failed save shows a summary and the sentence
 * again beside each field.
 */
export function SendQuoteDialog({
  request,
  open,
  onOpenChange,
  send,
  paymentOpen,
}: {
  request: AdminDeliveryQuote;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  send: typeof sendDeliveryQuote;
  paymentOpen: boolean;
}) {
  const action = useAdminAction();
  const baseId = useId();
  const fieldId = (field: DeliveryQuoteInputField) => `${baseId}-${field}`;
  const [values, setValues] = useState<QuoteFormValues>(() => quoteFormValues(request));
  const [submits, setSubmits] = useState(0);
  const checked = checkQuoteForm(values);
  const errors = submits > 0 && !checked.ok ? checked.errors : {};
  const set = <K extends keyof QuoteFormValues>(key: K, value: QuoteFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const revising = request.status === "quoted";

  const submit = async () => {
    setSubmits((count) => count + 1);
    if (!checked.ok) return;
    const ok = await action.run(
      () => send({ quoteId: request.id, ...checked.body, idempotencyKey: action.idempotencyKey }),
      `Quote sent for ${request.orderReference}`,
      "send a delivery quote",
    );
    if (ok) onOpenChange(false);
  };

  const summary = (Object.keys(errors) as DeliveryQuoteInputField[]).map((field) => ({
    fieldId: fieldId(field),
    message: `${QUOTE_FIELD_LABELS[field]}: ${errors[field]}`,
  }));

  return (
    <>
      <StaffFormDialog
        open={open}
        onOpenChange={onOpenChange}
        title={`${revising ? "Revise the quote" : "Quote delivery"} for ${request.orderReference}`}
        description={`To ${request.countryName}. The buyer is emailed the price and a link to accept it and pay. The print is held for 3 more working days.`}
        submitLabel={revising ? "Send revised quote" : "Send quote"}
        pending={action.pending}
        onSubmit={() => void submit()}
        size="md"
      >
        <FormErrorSummary focusKey={submits} errors={summary} />
        {action.error}
        {paymentOpen ? null : (
          <Notice
            tone="warning"
            title="Buyers can't pay for delivery outside the UK yet. They will see the quote, and we email them when payment opens."
          />
        )}
        <Field
          id={fieldId("pricePence")}
          label="Delivery price"
          description="Insurance included. The buyer pays any import duties on arrival."
          error={errors.pricePence}
        >
          <MoneyInput
            value={values.pricePence}
            onValueChange={(pence) => set("pricePence", pence)}
          />
        </Field>
        <Field id={fieldId("carrier")} label="Carrier" error={errors.carrier}>
          <TextInput
            autoComplete="off"
            maxLength={QUOTE_CARRIER_MAX_LENGTH}
            value={values.carrier}
            onChange={(event) => set("carrier", event.target.value)}
          />
        </Field>
        <Field id={fieldId("service")} label="Service" optional error={errors.service}>
          <TextInput
            autoComplete="off"
            maxLength={QUOTE_SERVICE_MAX_LENGTH}
            value={values.service}
            onChange={(event) => set("service", event.target.value)}
          />
        </Field>
        <Field
          id={fieldId("leadTimeNote")}
          label="Delivery time"
          optional
          description="Said to the buyer as you write it, for example: Usually 5 to 7 working days."
          error={errors.leadTimeNote}
        >
          <TextInput
            autoComplete="off"
            maxLength={QUOTE_LEAD_TIME_NOTE_MAX_LENGTH}
            value={values.leadTimeNote}
            onChange={(event) => set("leadTimeNote", event.target.value)}
          />
        </Field>
        {request.quote ? (
          <p className="text-staff-sm text-staff-muted">
            Last quoted at {quotePrice(request.quote.pricePence)} with {request.quote.carrier}.
          </p>
        ) : null}
      </StaffFormDialog>
      {action.stepUpDialog}
    </>
  );
}
