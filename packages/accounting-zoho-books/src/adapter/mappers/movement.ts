import { type Expense, type Result, type Transfer, ok, refuse } from "@auction/accounting-domain";
import { penceToPounds } from "../money-format.js";
import type { ZohoOrgConfig } from "../org-config.js";
import { type MapCode, referenceField } from "./common.js";

type CustomFields = readonly { readonly customfield_id: string; readonly value: string }[];

export interface ExpenseBody {
  /** The Stripe fees expense account. */
  readonly account_id: string;
  /** The Stripe clearing account the fee was taken from. */
  readonly paid_through_account_id: string;
  readonly date: string;
  readonly amount: number;
  readonly currency_code: "GBP";
  readonly is_inclusive_tax: false;
  readonly reference_number: string;
  readonly description: string;
  readonly custom_fields: CustomFields;
}

export interface TransferBody {
  readonly transaction_type: "transfer_fund";
  /** The Stripe clearing account. */
  readonly from_account_id: string;
  /** The bank account Stripe pays out into. */
  readonly to_account_id: string;
  readonly date: string;
  readonly amount: number;
  readonly currency_code: "GBP";
  readonly reference_number: string;
  readonly description: string;
  readonly custom_fields: CustomFields;
}

export type MovementConfig = Pick<ZohoOrgConfig, "payments" | "stripe" | "laxReferenceField">;

/**
 * The longest reference Books' `reference_number` and the LAX reference custom field are taken to
 * hold (to be confirmed in the Books test organisation). Each capital in a Stripe id doubles, so
 * these references are the longest LAX makes: up to 77 characters (`LAX-SHOP-EXP-` and a
 * 64-character source id). A longer one is refused here, never cut short in Books.
 */
export const BOOKS_REFERENCE_MAX_LENGTH = 100;

function stripeAccounts(
  config: MovementConfig,
  reference: string,
): Result<NonNullable<ZohoOrgConfig["stripe"]>, MapCode> {
  if (reference.length > BOOKS_REFERENCE_MAX_LENGTH) {
    return refuse("reference_too_long", "the reference is longer than Books takes");
  }
  return config.stripe
    ? ok(config.stripe)
    : refuse("stripe_accounts_missing", "the Stripe fees and bank accounts are not configured");
}

/**
 * Expense -> Books expense: Stripe's fee charged to the Stripe fees account, paid through the
 * Stripe clearing account (where customer payments are deposited). No tax: Stripe's fees carry no
 * VAT LAX can reclaim, and none is sent.
 */
export function expenseBody(
  expense: Expense,
  config: MovementConfig,
): Result<ExpenseBody, MapCode> {
  const accounts = stripeAccounts(config, expense.reference);
  if (!accounts.ok) return accounts;
  return ok({
    account_id: accounts.value.feesAccountId,
    paid_through_account_id: config.payments.depositAccountId,
    date: expense.spentOn,
    amount: penceToPounds(expense.amountPence),
    currency_code: expense.currency,
    is_inclusive_tax: false,
    reference_number: expense.reference,
    description: expense.description,
    ...referenceField(config, expense.reference),
  });
}

/** Transfer -> Books bank transaction "transfer fund": Stripe clearing to the bank account. */
export function transferBody(
  transfer: Transfer,
  config: MovementConfig,
): Result<TransferBody, MapCode> {
  const accounts = stripeAccounts(config, transfer.reference);
  if (!accounts.ok) return accounts;
  return ok({
    transaction_type: "transfer_fund",
    from_account_id: config.payments.depositAccountId,
    to_account_id: accounts.value.bankAccountId,
    date: transfer.transferredOn,
    amount: penceToPounds(transfer.amountPence),
    currency_code: transfer.currency,
    reference_number: transfer.reference,
    description: transfer.description,
    ...referenceField(config, transfer.reference),
  });
}
