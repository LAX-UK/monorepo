import {
  type PaySeveralCandidate,
  type PaymentTierLimits,
  accountPurchaseScope,
  payTogether,
  planPaySeveral,
} from "@auction/domain";
import type {
  IAccountPurchaseFactsReader,
  IPaySeveralInvoiceFlagsReader,
} from "@auction/persistence/interfaces";
import { err, ok } from "neverthrow";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import type { ISettlementCompliancePolicy } from "../aml/settlement-compliance.policy.js";
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
import {
  buyingError,
  entityActorOf,
  memberIsPayer,
  paySeveralCandidate,
  purchaseView,
} from "./purchase-view.js";

/** Every invoice is raised in pounds sterling. */
const INVOICE_CURRENCY = "GBP";

const CHECKOUT_ERRORS: Record<GroupCheckoutError, OrganisationBuyingErrorCode> = {
  conflict: "pay_several_conflict",
  unavailable: "pay_several_unavailable",
};

export type PaySeveralDeps = {
  reader: IAccountPurchaseFactsReader;
  flags: IPaySeveralInvoiceFlagsReader;
  limits: PaymentTierLimits;
  compliance: Pick<ISettlementCompliancePolicy, "peek" | "evaluate"> | null;
  checkout: Pick<PaymentGroupCheckoutService, "start">;
  now: () => Date;
};

/**
 * "Pay several": which of the picked invoices one payment settles, and opening that payment. The
 * domain decides what is payable (`planPaySeveral`) and whether the total can be paid at once and
 * how (`payTogether`); the payment group does the money side.
 */
export class PaySeveralService implements IPaySeveralService {
  constructor(private readonly deps: PaySeveralDeps) {}

  async plan(
    actor: OrganisationMemberActor,
    lotIds: readonly string[],
  ): BuyingResult<PaySeveralQuote> {
    const scope = accountPurchaseScope(entityActorOf(actor));
    if (!scope) return err(buyingError("insufficient_entity_role"));
    const picks = await this.candidates(actor, scope === "own", lotIds);
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
    // move, on the total the payer is paying.
    if (this.deps.compliance) {
      const hold = await this.deps.compliance.evaluate({
        buyerUserId: actor.userId,
        amountPence: gbpAmountToPence(plan.total),
      });
      if (hold.hold) return err(buyingError("pay_several_payer_on_hold"));
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

  private async candidates(
    actor: OrganisationMemberActor,
    ownOnly: boolean,
    lotIds: readonly string[],
  ): Promise<PaySeveralCandidate[]> {
    const rows = lotIds.length
      ? await this.deps.reader.list({
          legalEntityId: actor.legalEntityId,
          memberUserId: ownOnly ? actor.userId : null,
          lotIds,
          limit: lotIds.length,
          offset: 0,
        })
      : [];
    const now = this.deps.now();
    const views = rows.map((row) => purchaseView(row, actor, now));
    const paymentIds = views.flatMap((v) => (v.invoice.paymentId ? [v.invoice.paymentId] : []));
    const flags = await this.deps.flags.flagsFor(paymentIds);
    const byLot = new Map(
      views.map((view) => {
        const flag = view.invoice.paymentId ? flags.get(view.invoice.paymentId) : undefined;
        return [
          view.lotId,
          paySeveralCandidate(view, actor.legalEntityId, INVOICE_CURRENCY, {
            heldForReview: flag?.heldForReview ?? false,
            inPaymentInProgress: flag?.inPaymentInProgress ?? false,
          }),
        ];
      }),
    );
    // A pick outside what the member follows in this account is treated as another account's.
    return lotIds.map(
      (lotId) =>
        byLot.get(lotId) ?? {
          lotId,
          paymentId: null,
          buyerAccountId: "",
          invoice: "not_invoiced",
          payerMayPay: false,
          totalDue: null,
          currency: INVOICE_CURRENCY,
          heldForReview: false,
          inPaymentInProgress: false,
        },
    );
  }
}
