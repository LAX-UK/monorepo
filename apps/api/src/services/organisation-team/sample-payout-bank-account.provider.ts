import type { ProviderBankAccount } from "@auction/domain";
import type { IPayoutBankAccountProvider } from "../interfaces/organisation-profile-service.js";

/**
 * A stand-in payout provider for local development without Stripe keys: every connected account
 * has the same sample UK bank account, so the Payouts pages can be built and reviewed without
 * calling Stripe. The composition root only uses it when Stripe is not configured outside
 * production.
 */
export class SamplePayoutBankAccountProvider implements IPayoutBankAccountProvider {
  async defaultBankAccount(_connectedAccountId: string): Promise<ProviderBankAccount | null> {
    return {
      bankName: "BARCLAYS BANK PLC",
      last4: "0042",
      accountHolderName: "Sample Account Holder",
      currency: "gbp",
      providerStatus: "verified",
    };
  }
}
