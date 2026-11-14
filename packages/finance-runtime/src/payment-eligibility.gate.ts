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
   * Personal payers must be verified even when no identity provider is configured (wherever
   * payments are live, see {@link paymentsAreLive}):
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

/** What decides whether a deployment takes real payments. */
export type PaymentsLiveEnv = {
  NODE_ENV?: string | undefined;
  /** The deployment environment flag, decoupled from NODE_ENV. */
  APP_ENV?: string | undefined;
  STRIPE_SECRET_KEY?: string | undefined;
};

/**
 * True when this deployment takes real money: a production build, a production deployment
 * (whatever NODE_ENV says), or a live Stripe key. Any one of them is enough.
 */
export function paymentsAreLive(env: PaymentsLiveEnv): boolean {
  return (
    env.NODE_ENV === "production" ||
    env.APP_ENV === "production" ||
    (env.STRIPE_SECRET_KEY?.trim().startsWith("sk_live_") ?? false)
  );
}

/**
 * The one gate the API and the worker build. Wherever payments are live, a personal payer is
 * held when no identity provider can verify them, never paid unchecked.
 */
export function createPaymentEligibilityGate(input: {
  accounts: Pick<ILegalEntityRepository, "findById">;
  identity: Pick<IBidActorEligibilityReader, "findBidActorEligibility"> | null;
  env: PaymentsLiveEnv;
}): PaymentEligibilityGate {
  return new PaymentEligibilityGate(input.accounts, input.identity, {
    identityRequired: paymentsAreLive(input.env),
  });
}
