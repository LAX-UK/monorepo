/**
 * The bank account an organisation is paid into, as its members may see it. The payout provider
 * holds the account; the product only ever shows a summary: the bank's name, the last four
 * digits, the holder's name, the currency and whether money can be paid into it. A full account
 * number or sort code never leaves the provider adapter.
 */

/** What the provider says about the account, in its own words. */
export type ProviderBankAccount = {
  bankName: string | null;
  last4: string | null;
  accountHolderName: string | null;
  currency: string | null;
  /** The provider's state for the account (for example `new`, `verified` or `errored`). */
  providerStatus: string | null;
};

/**
 * - `ready`: payouts can be sent to it;
 * - `failed`: a payout to it bounced, or it could not be verified, so it needs replacing.
 */
export type PayoutBankAccountStatus = "ready" | "failed";

export type PayoutBankAccountSummary = {
  bankName: string | null;
  /** Exactly four digits, or `null`. */
  last4: string | null;
  accountHolderName: string | null;
  /** ISO 4217, upper case. */
  currency: string | null;
  status: PayoutBankAccountStatus;
};

/** Provider states in which the account cannot be paid into. */
const FAILED_STATES = new Set(["errored", "verification_failed"]);

const LAST4 = /^\d{4}$/;

/** Keeps the last four digits only when that is all there is: anything longer is dropped. */
function safeLast4(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return LAST4.test(trimmed) ? trimmed : null;
}

function text(value: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** The client-safe summary of the provider's account. */
export function payoutBankAccountSummary(account: ProviderBankAccount): PayoutBankAccountSummary {
  return {
    bankName: text(account.bankName),
    last4: safeLast4(account.last4),
    accountHolderName: text(account.accountHolderName),
    currency: text(account.currency)?.toUpperCase() ?? null,
    status: FAILED_STATES.has(account.providerStatus ?? "") ? "failed" : "ready",
  };
}
