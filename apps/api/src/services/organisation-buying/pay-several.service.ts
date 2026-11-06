import {
  type PaymentTierLimits,
  accountPurchaseScope,
  payTogether,
  planPaySeveral,
} from "@auction/domain";
import { err, ok } from "neverthrow";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import {
  type ISettlementCompliancePolicy,
  evaluateSettlementSubjects,
} from "../aml/settlement-compliance.policy.js";
import type {
  BuyingResult,
  IPaySeveralService,
  OrganisationBuyingErrorCode,
  PaySeveralQuote,
  PaySeveralStarted,
} from "../interfaces/organisation-buying-service.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import type {
  GroupCheckoutError,
  PaymentGroupCheckoutService,
} from "../payment-group/payment-group-checkout.service.js";
import type { IPaymentEligibilityGate } from "../payment/payment-eligibility.gate.js";
import type { PurchaseCandidateReader } from "./purchase-candidate.reader.js";
import { buyingError, entityActorOf, memberIsPayer } from "./purchase-view.js";

const CHECKOUT_ERRORS: Record<GroupCheckoutError, OrganisationBuyingErrorCode> = {
  conflict: "pay_several_conflict",
  unavailable: "pay_several_unavailable",
};

export type PaySeveralDeps = {
  /** The same reading of the picked lots as the pay plan, so the two never disagree. */
  candidates: Pick<PurchaseCandidateReader, "read">;
  limits: PaymentTierLimits;
  compliance: Pick<ISettlementCompliancePolicy, "peek" | "evaluate"> | null;
  /** The same account checks as paying one invoice: closed organisations, unverified buyers. */
  eligibility: IPaymentEligibilityGate;
  checkout: Pick<PaymentGroupCheckoutService, "start">;
};

/**
 * "Pay several": which of the picked invoices one payment settles, and opening that payment. The
 * domain decides what is payable (`planPaySeveral`) and whether the total can be paid at once and
 * how (`payTogether`); the payment group does the money side.
 */
export class PaySeveralService implements IPaySeveralService {
  constructor(private readonly deps: PaySeveralDeps) {}

  private candidates(actor: OrganisationMemberActor, ownOnly: boolean, lotIds: readonly string[]) {
    return this.deps.candidates.read(actor, ownOnly, lotIds);
  }

  async plan(
    actor: OrganisationMemberActor,
    lotIds: readonly string[],
  ): BuyingResult<PaySeveralQuote> {
    const scope = accountPurchaseScope(entityActorOf(actor));
    if (!scope) return err(buyingError("insufficient_entity_role"));
    // The same account rule as paying one invoice: closed accounts are refused, and accounts that
    // cannot pay yet are told what happens next instead of being offered a payment.
    const eligibility = await this.deps.eligibility.check({
      payerUserId: actor.userId,
      buyerLegalEntityId: actor.legalEntityId,
    });
    if (eligibility.kind !== "payable") return err(buyingError(eligibility.reason));
    const { picks } = await this.candidates(actor, scope === "own", lotIds);
    const decision = planPaySeveral(actor.legalEntityId, picks);
    if (!decision.allowed) return err(buyingError(decision.reason));
    const payerOnHold = this.deps.compliance
      ? (await this.deps.compliance.peek(actor.userId)).hold
      : false;
    return ok({
      ...decision.plan,
      payTogether: payTogether(
        gbpAmountToPence(decision.plan.total),
        this.deps.limits,
        payerOnHold,
      ),
    });
  }

  async pay(
    actor: OrganisationMemberActor,
    lotIds: readonly string[],
  ): BuyingResult<PaySeveralStarted> {
    if (!memberIsPayer(actor)) return err(buyingError("insufficient_entity_role"));
    const quote = await this.plan(actor, lotIds);
    if (quote.isErr()) return err(quote.error);
    const plan = quote.value;
    if (!plan.payTogether.allowed) {
      return err(buyingError(`pay_several_${plan.payTogether.reason}`));
    }
    // The full check (which can open a source-of-funds case) runs only when money is about to
    // move: for the payer on the total, and for each lot's winner on what they won.
    if (this.deps.compliance) {
      const { winners } = await this.candidates(
        actor,
        false,
        plan.payable.map((p) => p.lotId),
      );
      const hold = await evaluateSettlementSubjects(
        this.deps.compliance,
        [
          { buyerUserId: actor.userId, amountPence: gbpAmountToPence(plan.total) },
          ...plan.payable.flatMap((p) => {
            const winner = winners.get(p.lotId);
            return winner && winner !== actor.userId && p.totalDue
              ? [{ buyerUserId: winner, amountPence: gbpAmountToPence(p.totalDue) }]
              : [];
          }),
        ],
        plan.payable.flatMap((p) => (p.paymentId ? [p.paymentId] : [])),
      );
      if (hold.hold) {
        return err(
          buyingError(
            hold.subject === actor.userId
              ? "pay_several_payer_on_hold"
              : "pay_several_winner_on_hold",
          ),
        );
      }
    }
    const started = await this.deps.checkout.start({
      payerUserId: actor.userId,
      buyerLegalEntityId: actor.legalEntityId,
      currency: plan.currency,
      total: plan.total,
      rail: plan.payTogether.rail,
      invoices: plan.payable.map((p) => ({
        paymentId: p.paymentId,
        lotId: p.lotId,
        amount: p.totalDue,
      })),
    });
    if (started.isErr()) return err(buyingError(CHECKOUT_ERRORS[started.error]));
    return ok({
      ...started.value,
      total: plan.total,
      currency: plan.currency,
      payable: plan.payable.map((p) => ({ lotId: p.lotId, amount: p.totalDue })),
      skipped: plan.skipped,
    });
  }
}
