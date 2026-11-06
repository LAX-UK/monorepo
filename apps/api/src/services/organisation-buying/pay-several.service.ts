import { type PaymentTierLimits, paySeveralSkipReason, payTogether } from "@auction/domain";
import type { LotInvoiceInitiationService } from "@auction/finance-runtime";
import type { PayPlan } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { gbpPenceToMajorString } from "../../lib/decimal-money.js";
import {
  type ISettlementCompliancePolicy,
  evaluateSettlementSubjects,
} from "../aml/settlement-compliance.policy.js";
import type {
  BuyingResult,
  IPayPlanService,
  IPaySeveralService,
  OrganisationBuyingError,
  OrganisationBuyingErrorCode,
  PaySeveralQuote,
  PaySeveralStarted,
  PlannedPayment,
} from "../interfaces/organisation-buying-service.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import type {
  GroupCheckoutError,
  PaymentGroupCheckoutService,
} from "../payment-group/payment-group-checkout.service.js";
import { accountGateRefusal } from "./pay-plan-gate-refusal.js";
import { buyingError, memberIsPayer } from "./purchase-view.js";

const CHECKOUT_ERRORS: Record<GroupCheckoutError, OrganisationBuyingErrorCode> = {
  conflict: "pay_several_conflict",
  unavailable: "pay_several_unavailable",
};

export type PaySeveralDeps = {
  /** The same planner as the Pay page, so what is shown and what is paid are one decision. */
  planner: Pick<IPayPlanService, "planWithWinners">;
  /** Raises the invoice of a won lot that has none yet: the lot-end path, with its guards. */
  invoices: Pick<LotInvoiceInitiationService, "ensureForLot">;
  limits: PaymentTierLimits;
  /** The full check, which can open a source-of-funds case. Only run when money is about to move. */
  compliance: Pick<ISettlementCompliancePolicy, "evaluate"> | null;
  checkout: Pick<PaymentGroupCheckoutService, "start">;
};

/**
 * "Pay several": which of the picked invoices one payment settles, and opening that payment.
 *
 * What is payable is decided once, by the pay plan. Starting the payment first raises the
 * invoices of lots that have none yet (as lot end would), then reads the plan again and charges
 * exactly what that second plan lists. Nothing is claimed until every invoice exists, so a raise
 * that fails leaves nothing held; the invoices already raised are ordinary invoices that lot end
 * would have raised too.
 */
export class PaySeveralService implements IPaySeveralService {
  constructor(private readonly deps: PaySeveralDeps) {}

  async plan(
    actor: OrganisationMemberActor,
    lotIds: readonly string[],
  ): BuyingResult<PaySeveralQuote> {
    const read = await this.read(actor, lotIds);
    if (read.isErr()) return err(read.error);
    const { plan } = read.value;
    return ok({
      payable: plan.payable.map((p) => ({
        lotId: p.lotId,
        totalDue: gbpPenceToMajorString(p.totalPence),
      })),
      skipped: plan.leftOut.map((l) => ({
        lotId: l.lotId,
        reason: paySeveralSkipReason(l.reason),
      })),
      currency: plan.currency,
      total: gbpPenceToMajorString(plan.totals.pence),
      // A check open on the amount stops the payment; the finance threshold and the limits are
      // decided on the total by `payTogether`.
      payTogether: payTogether(
        plan.totals.pence,
        this.deps.limits,
        plan.gate.kind === "compliance",
      ),
    });
  }

  async pay(
    actor: OrganisationMemberActor,
    lotIds: readonly string[],
  ): BuyingResult<PaySeveralStarted> {
    if (!memberIsPayer(actor)) return err(buyingError("insufficient_entity_role"));
    const ready = await this.raiseAndPlan(actor, lotIds);
    if (ready.isErr()) return err(ready.error);
    const { plan, winners } = ready.value;

    // The full check (which can open a source-of-funds case) runs only when money is about to
    // move: for the payer on the total, and for each lot's winner on what they won.
    const hold = await this.complianceHold(actor, plan, winners);
    if (hold) return err(buyingError(hold));
    const together = payTogether(plan.totals.pence, this.deps.limits, false);
    if (!together.allowed) return err(buyingError(`pay_several_${together.reason}`));

    const total = gbpPenceToMajorString(plan.totals.pence);
    const started = await this.deps.checkout.start({
      payerUserId: actor.userId,
      buyerLegalEntityId: actor.legalEntityId,
      currency: plan.currency,
      total,
      rail: together.rail,
      invoices: plan.payable.map((p) => ({
        paymentId: invoicedPaymentId(p),
        lotId: p.lotId,
        amount: gbpPenceToMajorString(p.totalPence),
      })),
    });
    if (started.isErr()) return err(buyingError(CHECKOUT_ERRORS[started.error]));
    return ok({
      ...started.value,
      total,
      currency: plan.currency,
      payable: plan.payable.map((p) => ({
        lotId: p.lotId,
        amount: gbpPenceToMajorString(p.totalPence),
      })),
      skipped: plan.leftOut.map((l) => ({
        lotId: l.lotId,
        reason: paySeveralSkipReason(l.reason),
      })),
    });
  }

  /** The plan, refused when the account cannot pay or nothing in it can be paid. */
  private async read(
    actor: OrganisationMemberActor,
    lotIds: readonly string[],
  ): Promise<Result<PlannedPayment, OrganisationBuyingError>> {
    const planned = await this.deps.planner.planWithWinners(actor, lotIds);
    if (planned.isErr()) return err(planned.error);
    const refusal = accountGateRefusal(planned.value.plan.gate);
    if (refusal) return err(buyingError(refusal));
    if (planned.value.plan.payable.length === 0) {
      return err(buyingError("pay_several_nothing_payable"));
    }
    return ok(planned.value);
  }

  /**
   * The plan to charge: every payable lot has its invoice. Lots without one are raised first
   * (unless a check on the amount is open, which is opened and reported before anything is
   * raised), and the plan is read again, since the raise decides what each invoice is and
   * whether it is held.
   */
  private async raiseAndPlan(
    actor: OrganisationMemberActor,
    lotIds: readonly string[],
  ): Promise<Result<PlannedPayment, OrganisationBuyingError>> {
    const first = await this.read(actor, lotIds);
    if (first.isErr()) return first;
    const missing = first.value.plan.payable.filter((p) => p.paymentId === null);
    if (missing.length === 0) return first;

    if (first.value.plan.gate.kind === "compliance") {
      const hold = await this.complianceHold(actor, first.value.plan, first.value.winners);
      if (hold) return err(buyingError(hold));
    }
    if (!(await this.raise(missing.map((p) => p.lotId)))) {
      return err(buyingError("pay_several_unavailable"));
    }
    const second = await this.read(actor, lotIds);
    if (second.isErr()) return second;
    // A lot that still has no invoice cannot be charged; the whole payment waits rather than
    // charging less than the person was shown.
    if (second.value.plan.payable.some((p) => p.paymentId === null)) {
      return err(buyingError("pay_several_unavailable"));
    }
    return second;
  }

  /** Raises the invoices one after another. Returns false, having logged why, if one fails. */
  private async raise(lotIds: readonly string[]): Promise<boolean> {
    for (const lotId of lotIds) {
      try {
        await this.deps.invoices.ensureForLot(lotId);
      } catch (error) {
        console.error(
          JSON.stringify({
            msg: "pay_several_raise_failed",
            lotId,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
        return false;
      }
    }
    return true;
  }

  /** The check on the amount, for the payer and for each lot's winner; the code if it holds. */
  private async complianceHold(
    actor: OrganisationMemberActor,
    plan: PayPlan,
    winners: ReadonlyMap<string, string | null>,
  ): Promise<"pay_several_payer_on_hold" | "pay_several_winner_on_hold" | null> {
    if (!this.deps.compliance) return null;
    const hold = await evaluateSettlementSubjects(
      this.deps.compliance,
      [
        { buyerUserId: actor.userId, amountPence: plan.totals.pence },
        ...plan.payable.flatMap((p) => {
          const winner = winners.get(p.lotId);
          return winner && winner !== actor.userId
            ? [{ buyerUserId: winner, amountPence: p.totalPence }]
            : [];
        }),
      ],
      plan.payable.flatMap((p) => (p.paymentId ? [p.paymentId] : [])),
    );
    if (!hold.hold) return null;
    return hold.subject === actor.userId
      ? "pay_several_payer_on_hold"
      : "pay_several_winner_on_hold";
  }
}

function invoicedPaymentId(payable: PayPlan["payable"][number]): string {
  if (!payable.paymentId) throw new Error(`Lot ${payable.lotId} has no invoice to pay`);
  return payable.paymentId;
}
