import { type BillPayment, type Result, ok, refuse } from "@auction/accounting-domain";
import { penceToPounds } from "../money-format.js";
import type { ZohoOrgConfig } from "../org-config.js";
import { type MapCode, referenceField } from "./common.js";

export interface BillPaymentBody {
  readonly vendor_id: string;
  readonly payment_mode: string;
  readonly amount: number;
  readonly date: string;
  readonly currency_code: "GBP";
  readonly reference_number: string;
  /** The account the money left: Stripe clearing, which a Stripe Connect transfer is paid from. */
  readonly paid_through_account_id: string;
  readonly bills: readonly { readonly bill_id: string; readonly amount_applied: number }[];
  readonly custom_fields: readonly { readonly customfield_id: string; readonly value: string }[];
}

export type BillPaymentConfig = Pick<ZohoOrgConfig, "payments" | "laxReferenceField">;

/**
 * BillPayment -> Books vendor payment of the whole bill, paid through the Stripe clearing account
 * (`payments.depositAccountId`, the same account Stripe's fees and payouts leave). Only a payment
 * from Stripe clearing exists in the domain; any other account is refused, never guessed.
 */
export function billPaymentBody(
  payment: BillPayment,
  vendorId: string,
  billId: string,
  config: BillPaymentConfig,
): Result<BillPaymentBody, MapCode> {
  if (payment.paidFrom !== "stripe_clearing") {
    return refuse("unmapped_account", "a bill is paid from Stripe clearing only");
  }
  if (billId === "") return refuse("unresolved_bill", "the bill has no Books id");
  const amount = penceToPounds(payment.amountPence);
  return ok({
    vendor_id: vendorId,
    payment_mode: config.payments.paymentMode,
    amount,
    date: payment.paidOn,
    currency_code: payment.currency,
    reference_number: payment.reference,
    paid_through_account_id: config.payments.depositAccountId,
    bills: [{ bill_id: billId, amount_applied: amount }],
    ...referenceField(config, payment.reference),
  });
}
