import type { ProviderBankAccount } from "@auction/domain";
import type { IStripeClientFactory } from "../../../lib/stripe-client.js";
import type { IPayoutBankAccountProvider } from "../../interfaces/organisation-profile-service.js";
import { requireConnectStripe } from "./connect-shared.js";

/** The fields of a Stripe external bank account this adapter reads; nothing else is copied. */
type StripeBankAccountFields = {
  object: string;
  bank_name?: string | null;
  last4?: string | null;
  account_holder_name?: string | null;
  currency?: string | null;
  status?: string | null;
  default_for_currency?: boolean | null;
};

/** A connected account normally has one bank account per currency; ten covers every real case. */
const PAGE = 10;

/** The bank account payouts go to: the default for its currency, else the first one listed. */
export function pickPayoutBankAccount(
  accounts: readonly StripeBankAccountFields[],
): ProviderBankAccount | null {
  const banks = accounts.filter((account) => account.object === "bank_account");
  const chosen = banks.find((account) => account.default_for_currency) ?? banks[0];
  if (!chosen) return null;
  return {
    bankName: chosen.bank_name ?? null,
    last4: chosen.last4 ?? null,
    accountHolderName: chosen.account_holder_name ?? null,
    currency: chosen.currency ?? null,
    providerStatus: chosen.status ?? null,
  };
}

/** Reads the connected account's bank account from Stripe Connect. */
export class StripePayoutBankAccountProvider implements IPayoutBankAccountProvider {
  constructor(private readonly stripeFactory: IStripeClientFactory) {}

  async defaultBankAccount(connectedAccountId: string): Promise<ProviderBankAccount | null> {
    const stripe = requireConnectStripe(this.stripeFactory);
    const list = await stripe.accounts.listExternalAccounts(connectedAccountId, {
      object: "bank_account",
      limit: PAGE,
    });
    return pickPayoutBankAccount(list.data as StripeBankAccountFields[]);
  }
}
