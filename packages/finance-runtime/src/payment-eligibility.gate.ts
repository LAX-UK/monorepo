import {
  type PaymentEligibility,
  type SelfServiceActorKycStatus,
  paymentEligibility,
} from "@auction/domain";
import type {
  IBidActorEligibilityReader,
  ILegalEntityRepository,
} from "@auction/persistence/interfaces";

/** Asks the domain rule whether the buyer account may pay now (single invoice or several). */
export interface IPaymentEligibilityGate {
  check(input: { payerUserId: string; buyerLegalEntityId: string }): Promise<PaymentEligibility>;
}

export type PaymentEligibilityGateOptions = {
  /**
   * Personal payers must be verified even when no identity provider is configured (production):
   * without one nobody can be verified, so their invoices are held rather than paid unchecked.
   */
  identityRequired?: boolean;
};

/**
 * Reads the facts for {@link paymentEligibility}. A read that fails throws, so the payment fails
 * rather than going ahead unchecked. The API and the worker use this one gate.
 */
export class PaymentEligibilityGate implements IPaymentEligibilityGate {
  constructor(
    private readonly accounts: Pick<ILegalEntityRepository, "findById">,
    /** The payer's identity check; null where no identity provider is configured to verify it. */
    private readonly identity: Pick<IBidActorEligibilityReader, "findBidActorEligibility"> | null,
    private readonly options: PaymentEligibilityGateOptions = {},
  ) {}

  async check(input: {
    payerUserId: string;
    buyerLegalEntityId: string;
  }): Promise<PaymentEligibility> {
    const account = await this.accounts.findById(input.buyerLegalEntityId);
    if (!account) throw new Error("payment_buyer_account_not_found");
    return paymentEligibility({
      accountKind: account.kind,
      accountStatus: account.status,
      payerKycStatus:
        account.kind === "individual" ? await this.payerKycStatus(input.payerUserId) : null,
    });
  }

  private async payerKycStatus(payerUserId: string): Promise<SelfServiceActorKycStatus | null> {
    if (!this.identity) return this.options.identityRequired ? "unverified" : null;
    return (await this.identity.findBidActorEligibility(payerUserId))?.kycStatus ?? "unverified";
  }
}
