import { type PaymentEligibility, paymentEligibility } from "@auction/domain";
import type {
  IBidActorEligibilityReader,
  ILegalEntityRepository,
} from "@auction/persistence/interfaces";

/** Asks the domain rule whether the buyer account may pay now (single invoice or several). */
export interface IPaymentEligibilityGate {
  check(input: { payerUserId: string; buyerLegalEntityId: string }): Promise<PaymentEligibility>;
}

/** What a refusal tells the payer; the same for both ways of paying. */
export const PAYMENT_ELIGIBILITY_REFUSAL = {
  organisation_closed: {
    message: "This account is closed, so it cannot pay. Contact us about this purchase.",
    status: 403,
  },
} as const;

/** What a hold tells the payer when they try to pay several invoices at once. */
export const PAYMENT_ELIGIBILITY_HOLD = {
  identity_verification_required: {
    message: "Verify your identity, then you can pay. Your invoices stay as they are meanwhile.",
    status: 409,
  },
  organisation_under_review: {
    message:
      "We are still checking your organisation. You can pay once we have; we will let you know.",
    status: 409,
  },
} as const;

/**
 * Reads the facts for {@link paymentEligibility}. A read that fails throws, so the payment fails
 * rather than going ahead unchecked.
 */
export class PaymentEligibilityGate implements IPaymentEligibilityGate {
  constructor(
    private readonly accounts: Pick<ILegalEntityRepository, "findById">,
    /** The payer's identity check; null where no identity provider is configured to verify it. */
    private readonly identity: Pick<IBidActorEligibilityReader, "findBidActorEligibility"> | null,
  ) {}

  async check(input: {
    payerUserId: string;
    buyerLegalEntityId: string;
  }): Promise<PaymentEligibility> {
    const account = await this.accounts.findById(input.buyerLegalEntityId);
    if (!account) throw new Error("payment_buyer_account_not_found");
    const payerKycStatus =
      account.kind === "individual" && this.identity
        ? ((await this.identity.findBidActorEligibility(input.payerUserId))?.kycStatus ??
          "unverified")
        : null;
    return paymentEligibility({
      accountKind: account.kind,
      accountStatus: account.status,
      payerKycStatus,
    });
  }
}
