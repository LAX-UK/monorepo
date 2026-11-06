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
  PaySeveralRequest,
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

/** One invoice the payment will take, with the payment it settles. */
type Charge = { lotId: string; paymentId: string; pence: number };

/** The plan as the combined-payment screen tells it, and what charging it would take. */
type PlanView = {
  quote: PaySeveralQuote;
  totalPence: number;
  /** Payable lots with their payment; `null` while a lot still has no invoice. */
  charges: { lotId: string; paymentId: string | null; pence: number }[];
};

/**
 * "Pay several": which of the picked invoices one payment settles, and opening that payment.
 *
 * What is payable is decided once, by the pay plan. Starting the payment checks that the plan
 * still is what the person was shown (the total and the lots), checks the limits on the total,
 * then raises the invoices of lots that have none yet (as lot end would, without writing to
 * accounting: the group checkout does that), reads the plan again and checks again. Only then does
 * it run the compliance check and claim exactly what that plan lists. A plan that changed answers
 * 409 with the fresh plan, so nothing is ever charged that was not shown. Nothing is claimed until
 * every invoice exists; invoices already raised are ordinary invoices that lot end would have
 * raised too, and raising is idempotent.
 */
export class PaySeveralService implements IPaySeveralService {
  constructor(private readonly deps: PaySeveralDeps) {}

  async plan(
    actor: OrganisationMemberActor,
    lotIds: readonly string[],
  ): BuyingResult<PaySeveralQuote> {
    const read = await this.read(actor, lotIds);
    if (read.isErr()) return err(read.error);
    return ok(this.view(read.value.plan, new Set()).quote);
  }

  async pay(
    actor: OrganisationMemberActor,
    request: PaySeveralRequest,
  ): BuyingResult<PaySeveralStarted> {
    if (!memberIsPayer(actor)) return err(buyingError("insufficient_entity_role"));
    const first = await this.read(actor, request.lotIds);
    if (first.isErr()) return err(first.error);

    let current = this.view(first.value.plan, new Set());
    let winners = first.value.winners;
    const early = this.refusal(current, request);
    if (early) return err(early);

    const missing = current.charges.filter((c) => c.paymentId === null).map((c) => c.lotId);
    if (missing.length > 0) {
      // A check on the amount that is still open is run (it opens the case) before anything is
      // raised for a payment that cannot go ahead.
      if (first.value.plan.gate.kind === "compliance") {
        const hold = await this.complianceHold(actor, current, winners);
        if (hold) return err(buyingError(hold));
      }
      const raised = await this.raise(missing);
      if (!raised) return err(buyingError("pay_several_unavailable"));
      const second = await this.read(actor, request.lotIds);
      if (second.isErr()) return err(second.error);
      winners = second.value.winners;
      current = this.view(second.value.plan, new Set(raised.refused));
      // A lot that still has no invoice for no stated reason cannot be charged; the whole payment
      // waits rather than charging less than the person was shown.
      if (current.charges.some((c) => c.paymentId === null)) {
        return err(buyingError("pay_several_unavailable"));
      }
      const changed = this.refusal(current, request);
      if (changed) return err(changed);
    }

    // The full check (which can open a source-of-funds case) runs only when money is about to
    // move: for the payer on the total, and for each lot's winner on what they won.
    const hold = await this.complianceHold(actor, current, winners);
    if (hold) return err(buyingError(hold));
    const together = payTogether(current.totalPence, this.deps.limits, false);
    if (!together.allowed) return err(buyingError(`pay_several_${together.reason}`));

    const total = gbpPenceToMajorString(current.totalPence);
    const charges = current.charges.map(settled);
    const started = await this.deps.checkout.start({
      payerUserId: actor.userId,
      buyerLegalEntityId: actor.legalEntityId,
      currency: current.quote.currency,
      total,
      rail: together.rail,
      invoices: charges.map((c) => ({
        paymentId: c.paymentId,
        lotId: c.lotId,
        amount: gbpPenceToMajorString(c.pence),
      })),
    });
    if (started.isErr()) return err(buyingError(CHECKOUT_ERRORS[started.error]));
    return ok({
      ...started.value,
      total,
      currency: current.quote.currency,
      payable: charges.map((c) => ({ lotId: c.lotId, amount: gbpPenceToMajorString(c.pence) })),
      skipped: current.quote.skipped,
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

  /** The plan told in the screen's terms; lots refused at raise time are left out as not invoiced. */
  private view(plan: PayPlan, notInvoiced: ReadonlySet<string>): PlanView {
    const payable = plan.payable.filter((p) => !notInvoiced.has(p.lotId));
    const totalPence = payable.reduce((sum, p) => sum + p.totalPence, 0);
    return {
      totalPence,
      charges: payable.map((p) => ({
        lotId: p.lotId,
        paymentId: p.paymentId,
        pence: p.totalPence,
      })),
      quote: {
        payable: payable.map((p) => ({
          lotId: p.lotId,
          totalDue: gbpPenceToMajorString(p.totalPence),
        })),
        skipped: [
          ...plan.leftOut.map((l) => ({
            lotId: l.lotId,
            reason: paySeveralSkipReason(l.reason),
          })),
          ...plan.payable
            .filter((p) => notInvoiced.has(p.lotId))
            .map((p) => ({ lotId: p.lotId, reason: "not_invoiced" as const })),
        ],
        currency: plan.currency,
        total: gbpPenceToMajorString(totalPence),
        // A check open on the amount stops the payment; the finance threshold and the limits are
        // decided on the total by `payTogether`.
        payTogether: payTogether(totalPence, this.deps.limits, plan.gate.kind === "compliance"),
      },
    };
  }

  /**
   * Why this plan cannot be paid as asked: it is not the plan the person was shown (the fresh
   * plan comes back with the 409), or its total cannot be paid at once.
   */
  private refusal(view: PlanView, request: PaySeveralRequest): OrganisationBuyingError | null {
    const shown = new Set(request.expectedLotIds);
    const same =
      view.totalPence === request.expectedTotalPence &&
      view.charges.length === shown.size &&
      view.charges.every((c) => shown.has(c.lotId));
    if (!same) return { ...buyingError("pay_plan_changed"), quote: view.quote };
    const together = payTogether(view.totalPence, this.deps.limits, false);
    return together.allowed ? null : buyingError(`pay_several_${together.reason}`);
  }

  /**
   * Raises the invoices one after another. Returns `null`, having logged why, if one fails; else
   * the lots the lot-end guards refused to invoice (they are left out, not retried).
   */
  private async raise(lotIds: readonly string[]): Promise<{ refused: string[] } | null> {
    const refused: string[] = [];
    for (const lotId of lotIds) {
      try {
        const result = await this.deps.invoices.ensureForLot(lotId, { accounting: "defer" });
        if (!result.created && result.reason !== "payment_already_exists") {
          console.warn(
            JSON.stringify({ msg: "pay_several_lot_not_invoiced", lotId, reason: result.reason }),
          );
          refused.push(lotId);
        }
      } catch (error) {
        console.error(
          JSON.stringify({
            msg: "pay_several_raise_failed",
            lotId,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
        return null;
      }
    }
    return { refused };
  }

  /** The check on the amount, for the payer and for each lot's winner; the code if it holds. */
  private async complianceHold(
    actor: OrganisationMemberActor,
    view: PlanView,
    winners: ReadonlyMap<string, string | null>,
  ): Promise<"pay_several_payer_on_hold" | "pay_several_winner_on_hold" | null> {
    if (!this.deps.compliance) return null;
    const hold = await evaluateSettlementSubjects(
      this.deps.compliance,
      [
        { buyerUserId: actor.userId, amountPence: view.totalPence },
        ...view.charges.flatMap((c) => {
          const winner = winners.get(c.lotId);
          return winner && winner !== actor.userId
            ? [{ buyerUserId: winner, amountPence: c.pence }]
            : [];
        }),
      ],
      view.charges.flatMap((c) => (c.paymentId ? [c.paymentId] : [])),
    );
    if (!hold.hold) return null;
    return hold.subject === actor.userId
      ? "pay_several_payer_on_hold"
      : "pay_several_winner_on_hold";
  }
}

function settled(charge: PlanView["charges"][number]): Charge {
  if (!charge.paymentId) throw new Error(`Lot ${charge.lotId} has no invoice to pay`);
  return { lotId: charge.lotId, paymentId: charge.paymentId, pence: charge.pence };
}
