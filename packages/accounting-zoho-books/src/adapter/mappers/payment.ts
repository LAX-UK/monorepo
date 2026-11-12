import { type Payment, type Result, ok, refuse } from "@auction/accounting-domain";
import { penceToPounds } from "../money-format.js";
import type { ZohoOrgConfig } from "../org-config.js";
import { type MapCode, referenceField } from "./common.js";

export interface PaymentBody {
  readonly customer_id: string;
  readonly payment_mode: string;
  readonly amount: number;
  readonly date: string;
  readonly currency_code: "GBP";
  readonly reference_number: string;
  readonly account_id: string;
  readonly invoices: readonly { readonly invoice_id: string; readonly amount_applied: number }[];
  readonly custom_fields: readonly { readonly customfield_id: string; readonly value: string }[];
}

export type PaymentConfig = Pick<ZohoOrgConfig, "payments" | "laxReferenceField">;

/**
 * Payment -> Books customer payment, deposited in the Stripe clearing account. `invoiceIds` maps
 * each allocation's invoice reference to its Books id; money not allocated stays on the customer
 * as credit. An allocation whose invoice id is not there is refused: it would otherwise be sent
 * as an unapplied amount.
 */
export function paymentBody(
  payment: Payment,
  customerId: string,
  invoiceIds: ReadonlyMap<string, string>,
  config: PaymentConfig,
): Result<PaymentBody, MapCode> {
  const invoices: PaymentBody["invoices"][number][] = [];
  for (const allocation of payment.allocations) {
    const invoiceId = invoiceIds.get(allocation.invoiceReference);
    if (invoiceId === undefined || invoiceId === "") {
      return refuse("unresolved_invoice", "an allocation's invoice has no Books id");
    }
    invoices.push({ invoice_id: invoiceId, amount_applied: penceToPounds(allocation.amountPence) });
  }
  return ok({
    customer_id: customerId,
    payment_mode: config.payments.paymentMode,
    amount: penceToPounds(payment.amountPence),
    date: payment.receivedOn,
    currency_code: payment.currency,
    reference_number: payment.reference,
    account_id: config.payments.depositAccountId,
    invoices,
    ...referenceField(config, payment.reference),
  });
}
