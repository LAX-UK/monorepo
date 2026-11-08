import {
  type PayPlanComplianceHold,
  type PayPlanLot,
  type PaymentEligibility,
  type PaymentTierLimits,
  accountPurchaseScope,
  buildPayPlan,
  classifyPayPlanLots,
  invoiceDueAt,
  pickRefusal,
  validateCheckoutAmountPence,
} from "@auction/domain";
import type { InvoiceRaiser } from "@auction/finance-runtime";
import type {
  BidInvoiceRecord,
  IBidInvoiceReader,
  IChargeableDeliveryReader,
  ILegalEntityRepository,
  ILotRepository,
} from "@auction/persistence/interfaces";
import type { PayPlan, PayPlanDelivery } from "@auction/types";
import { err, ok } from "neverthrow";
import { gbpAmountToPence } from "../../lib/decimal-money.js";
import {
  type ISettlementComplianceAssessor,
  assessSettlementSubjects,
} from "../aml/settlement-compliance.policy.js";
import type {
  BuyingResult,
  IPayPlanService,
  PlannedPayment,
} from "../interfaces/organisation-buying-service.js";
import type { OrganisationMemberActor } from "../interfaces/organisation-membership-service.js";
import type { IPaymentEligibilityGate } from "../payment/payment-eligibility.gate.js";
import { type PayProgressResolver, groupedLotsOf } from "./pay-progress.resolver.js";
import type { PurchaseCandidateReader, PurchaseEntry } from "./purchase-candidate.reader.js";
import { buyingError, entityActorOf, memberIsPayer } from "./purchase-view.js";

export type PayPlanDeps = {
  candidates: Pick<PurchaseCandidateReader, "read">;
  invoices: Pick<IBidInvoiceReader, "findByPaymentIds">;
  /** Prices a lot that is not invoiced yet through the same calculator that raises invoices. */
  pricing: Pick<InvoiceRaiser, "price">;
  lots: Pick<ILotRepository, "findById">;
  accounts: Pick<ILegalEntityRepository, "findById">;
  onboarding: { isComplete(userId: string): Promise<boolean> };
  /** The account rule for closed organisations and unverified buyers. */
  eligibility: IPaymentEligibilityGate;
  /** Reads whether paying this amount would be held, without opening a case. */
  compliance: ISettlementComplianceAssessor | null;
  limits: PaymentTierLimits;
  /** Where a payment already under way for the picked lots stands. */
  progress: Pick<PayProgressResolver, "resolve">;
  /**
   * Accepted courier quotes that join the payment. `null` while delivery is not charged with the
   * invoices: the plan then lists none and the payment is the invoices alone.
   */
  delivery: IChargeableDeliveryReader | null;
  /** The company that issues Bid invoices. */
  issuer: PayPlan["entity"];
  now: () => Date;
};

const NO_HOLD: PayPlanComplianceHold = { hold: false };
const PAYABLE: PaymentEligibility = { kind: "payable" };

/**
 * The read behind the Pay page: for the lots picked, what is payable with the stored lines of
 * each invoice, what is left out and why, and whether the payment can be made now. It only reads:
 * it raises no invoice, opens no source-of-funds case and starts no checkout. A read it cannot
 * complete fails (503); it never answers "clear" from a failed check.
 */
export class PayPlanService implements IPayPlanService {
  constructor(private readonly deps: PayPlanDeps) {}

  async plan(actor: OrganisationMemberActor, lotIds: readonly string[]): BuyingResult<PayPlan> {
    const planned = await this.planWithWinners(actor, lotIds);
    return planned.map((p) => p.plan);
  }

  /**
   * The plan together with each lot's winner. "Pay several" decides through this same call, so
   * the plan a person is shown and the payment that is taken can never disagree.
   */
  async planWithWinners(
    actor: OrganisationMemberActor,
    lotIds: readonly string[],
  ): BuyingResult<PlannedPayment> {
    const refusal = pickRefusal(lotIds);
    if (refusal) return err(buyingError(refusal));
    const scope = accountPurchaseScope(entityActorOf(actor));
    if (!scope) return err(buyingError("insufficient_entity_role"));
    try {
      return ok(await this.build(actor, scope === "own", lotIds));
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "pay_plan_unavailable",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      return err(buyingError("pay_plan_unavailable"));
    }
  }

  private async build(
    actor: OrganisationMemberActor,
    ownOnly: boolean,
    lotIds: readonly string[],
  ): Promise<PlannedPayment> {
    const account = await this.deps.accounts.findById(actor.legalEntityId);
    if (!account) throw new Error("The acting account could not be read");

    const { entries, winners } = await this.deps.candidates.read(actor, ownOnly, lotIds);
    const invoices = await this.deps.invoices.findByPaymentIds(
      entries.flatMap((e) => (e.row?.payment ? [e.row.payment.id] : [])),
    );
    const now = this.deps.now();
    const payerRole = memberIsPayer(actor) ? "payer" : "informed";
    // A payment the payer left unfinished does not hold its invoices; one they finished does.
    const progressByGroup = await this.deps.progress.resolve(groupedLotsOf(entries));
    const underWay = (entry: PurchaseEntry) => {
      const group = entry.flags.group;
      return group ? (progressByGroup.get(group.id) ?? null) !== null : false;
    };
    const lots = await Promise.all(
      entries.map((entry) =>
        this.lotFacts(entry, actor, invoices, now, payerRole, underWay(entry)),
      ),
    );
    const classified = classifyPayPlanLots(actor.legalEntityId, lots, payerRole);
    const delivery = await this.deliveryFor(actor, classified.payable);
    // The checks run in the order the gate reports them, and stop at the first that applies.
    let onboardingComplete = true;
    let eligibility: PaymentEligibility = PAYABLE;
    let compliance: PayPlanComplianceHold = NO_HOLD;
    if (payerRole === "payer") {
      onboardingComplete = await this.deps.onboarding.isComplete(actor.userId);
      if (onboardingComplete) {
        eligibility = await this.deps.eligibility.check({
          payerUserId: actor.userId,
          buyerLegalEntityId: actor.legalEntityId,
        });
        if (eligibility.kind === "payable") {
          compliance = await this.complianceOn(actor, classified.payable, delivery, winners);
        }
      }
    }

    const plan = buildPayPlan({
      account: { legalEntityId: account.id, kind: account.kind, name: account.displayName },
      payerRole,
      entity: this.deps.issuer,
      onboardingComplete,
      eligibility,
      compliance,
      limits: this.deps.limits,
      classified,
      deliveryInPayment: this.deps.delivery !== null,
      delivery,
      progress: firstProgress(entries, progressByGroup),
    });
    return { plan, winners };
  }

  /** The accepted courier quotes for the lots the payment covers, at the price the buyer accepted. */
  private async deliveryFor(
    actor: OrganisationMemberActor,
    payable: readonly PayPlan["payable"][number][],
  ): Promise<PayPlanDelivery[]> {
    if (!this.deps.delivery || payable.length === 0) return [];
    const quotes = await this.deps.delivery.acceptedFor(
      actor.legalEntityId,
      payable.map((p) => p.lotId),
    );
    return quotes.map((q) => ({
      lotId: q.lotId,
      quoteId: q.quoteId,
      amountPence: gbpAmountToPence(q.amount),
      destination: q.destination,
      note: q.quoteNote,
    }));
  }

  /** What one picked lot is worth to the plan: stored lines for an invoice, priced lines if not. */
  private async lotFacts(
    entry: PurchaseEntry,
    actor: OrganisationMemberActor,
    invoices: ReadonlyMap<string, BidInvoiceRecord>,
    now: Date,
    payerRole: "payer" | "informed",
    inPaymentInProgress: boolean,
  ): Promise<PayPlanLot> {
    const { row, view } = entry;
    if (!row || !view) return notThisAccount(entry.lotId, now);

    const payment = row.payment;
    const invoice = payment ? invoices.get(payment.id) : undefined;
    if (payment && !invoice) throw new Error(`Payment ${payment.id} has no stored invoice`);

    const base = {
      lotId: row.lotId,
      buyerAccountId: actor.legalEntityId,
      title: row.lotTitle,
      lotNumber: row.lotNumber,
      saleTitle: row.saleTitle,
      invoice: view.invoice.status,
      paymentStatus: payment?.status ?? null,
      paymentId: payment?.id ?? null,
      invoiceId: invoice?.id ?? null,
      invoiceVoided: invoice?.voidedAt != null,
      payerMayPay: view.paymentRole === "payer",
      heldForReview: entry.flags.heldForReview,
      inPaymentInProgress,
    };
    if (invoice) return { ...base, lines: invoice.lines, dueAt: invoice.dueAt };

    // Not invoiced yet: price it as it would be invoiced now. A payer who may not pay this lot
    // sees it left out, so it is not priced; someone who does not pay still sees its figures.
    const leftOutForPayer = payerRole === "payer" && !base.payerMayPay;
    if (view.invoice.status !== "not_invoiced" || leftOutForPayer) {
      return { ...base, lines: [], dueAt: now };
    }
    const lot = await this.deps.lots.findById(row.lotId);
    if (!lot) throw new Error(`Lot ${row.lotId} could not be read`);
    const priced = await this.deps.pricing.price(lot);
    // An amount that cannot be taken online is invoiced by the saleroom team, not offered here.
    const online = validateCheckoutAmountPence(priced.totalPence, this.deps.limits) === "ok";
    return {
      ...base,
      heldForReview: base.heldForReview || !online,
      lines: priced.lines,
      dueAt: priced.existing?.dueAt ?? invoiceDueAt(now),
    };
  }

  /**
   * Whether paying these invoices would be held: the payer on the total, and each lot's winner on
   * what they won, as when the payment starts, but without opening a case.
   */
  private async complianceOn(
    actor: OrganisationMemberActor,
    payable: readonly PayPlan["payable"][number][],
    delivery: readonly PayPlanDelivery[],
    winners: ReadonlyMap<string, string | null>,
  ): Promise<PayPlanComplianceHold> {
    if (!this.deps.compliance || payable.length === 0) return NO_HOLD;
    // The payer is checked on everything they pay; a winner only on the lot they won.
    const total =
      payable.reduce((sum, p) => sum + p.totalPence, 0) +
      delivery.reduce((sum, d) => sum + d.amountPence, 0);
    const hold = await assessSettlementSubjects(
      this.deps.compliance,
      [
        { buyerUserId: actor.userId, amountPence: total },
        ...payable.flatMap((p) => {
          const winner = winners.get(p.lotId);
          return winner && winner !== actor.userId
            ? [{ buyerUserId: winner, amountPence: p.totalPence }]
            : [];
        }),
      ],
      payable.flatMap((p) => (p.paymentId ? [p.paymentId] : [])),
    );
    if (!hold.hold || !hold.reason) return NO_HOLD;
    return {
      hold: true,
      reason: hold.reason,
      subject: hold.subject === actor.userId ? "payer" : "winner",
    };
  }
}

/** The payment under way for the first picked lot that has one. */
function firstProgress(
  entries: readonly PurchaseEntry[],
  progressByGroup: ReadonlyMap<string, PayPlan["progress"]>,
): PayPlan["progress"] {
  for (const entry of entries) {
    const progress = entry.flags.group ? progressByGroup.get(entry.flags.group.id) : null;
    if (progress) return progress;
  }
  return null;
}

/** A pick that is not one of this account's purchases: left out, never described. */
function notThisAccount(lotId: string, now: Date): PayPlanLot {
  return {
    lotId,
    buyerAccountId: "",
    title: "",
    lotNumber: null,
    saleTitle: null,
    invoice: "not_invoiced",
    paymentStatus: null,
    paymentId: null,
    invoiceId: null,
    invoiceVoided: false,
    payerMayPay: false,
    heldForReview: false,
    inPaymentInProgress: false,
    lines: [],
    dueAt: now,
  };
}
