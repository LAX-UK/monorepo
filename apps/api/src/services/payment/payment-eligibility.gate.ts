import { type PaymentEligibilityRefusal, paymentEligibilityRefusal } from "@auction/domain";
import type {
  IBidActorEligibilityReader,
  ILegalEntityRepository,
} from "@auction/persistence/interfaces";

/** Asks the domain rule whether the buyer account may pay now (single invoice or several). */
export interface IPaymentEligibilityGate {
  refusal(input: {
    payerUserId: string;
    buyerLegalEntityId: string;
  }): Promise<PaymentEligibilityRefusal | null>;
}

/** What each refusal tells the payer, and its status; the same for both ways of paying. */
export const PAYMENT_ELIGIBILITY_REFUSAL: Record<
  PaymentEligibilityRefusal,
  { message: string; status: 403 }
> = {
  organisation_closed: {
    message: "This account is closed, so it cannot pay. Contact us about this purchase.",
    status: 403,
  },
  identity_verification_required: {
    message: "Verify your identity before you pay.",
    status: 403,
  },
};

/**
 * Reads the facts for {@link paymentEligibilityRefusal}. A read that fails throws, so the payment
 * fails rather than going ahead unchecked.
 */
export class PaymentEligibilityGate implements IPaymentEligibilityGate {
  constructor(
    private readonly accounts: Pick<ILegalEntityRepository, "findById">,
    /** The payer's identity check; null where no identity provider is configured to verify it. */
    private readonly identity: Pick<IBidActorEligibilityReader, "findBidActorEligibility"> | null,
  ) {}

  async refusal(input: {
    payerUserId: string;
    buyerLegalEntityId: string;
  }): Promise<PaymentEligibilityRefusal | null> {
    const account = await this.accounts.findById(input.buyerLegalEntityId);
    if (!account) throw new Error("payment_buyer_account_not_found");
    const payerKycStatus =
      account.kind === "individual" && this.identity
        ? ((await this.identity.findBidActorEligibility(input.payerUserId))?.kycStatus ??
          "unverified")
        : null;
    return paymentEligibilityRefusal({
      accountKind: account.kind,
      accountStatus: account.status,
      payerKycStatus,
    });
  }
}
