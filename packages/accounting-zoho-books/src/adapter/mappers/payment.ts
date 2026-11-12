import type { Payment } from "@auction/accounting-domain";
import { penceToPounds } from "../money-format.js";
import type { ZohoOrgConfig } from "../org-config.js";
import { referenceField } from "./common.js";

export interface PaymentBody {
  readonly customer_id: string;
  readonly payment_mode: string;
  readonly amount: number;
  readonly date: string;
  readonly reference_number: string;
  readonly account_id: string;
  readonly invoices: readonly { readonly invoice_id: string; readonly amount_applied: number }[];
  readonly custom_fields: readonly { readonly customfield_id: string; readonly value: string }[];
}

export type PaymentConfig = Pick<ZohoOrgConfig, "payments" | "laxReferenceField">;

/**
 * Payment -> Books customer payment, deposited in the Stripe clearing account. `invoiceIds` maps
 * each allocation's invoice reference to its Books id; money not allocated stays on the customer
 * as credit. The caller resolves every id first.
 */
export function paymentBody(
  payment: Payment,
  customerId: string,
  invoiceIds: ReadonlyMap<string, string>,
  config: PaymentConfig,
): PaymentBody {
  return {
    customer_id: customerId,
    payment_mode: config.payments.paymentMode,
    amount: penceToPounds(payment.amountPence),
    date: payment.receivedOn,
    reference_number: payment.reference,
    account_id: config.payments.depositAccountId,
    invoices: payment.allocations.map((a) => ({
      invoice_id: invoiceIds.get(a.invoiceReference) ?? "",
      amount_applied: penceToPounds(a.amountPence),
    })),
    ...referenceField(config, payment.reference),
  };
}
