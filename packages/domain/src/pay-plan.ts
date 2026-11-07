import {
  type InvoiceLine,
  type PayPlan,
  type PayPlanGate,
  type PayPlanLeftOutReason,
  type PayPlanPayable,
  type PaymentStatus,
  invoiceLineKinds,
} from "@auction/types";
import type { PaymentEligibility } from "./payment-eligibility.js";
import { type PaymentTierLimits, paymentMethodsFor } from "./payment-tier-policy.js";
import { type PurchaseInvoiceStatus, invoiceIsOwed } from "./purchase-invoice-state.js";

/** One picked lot, with everything the plan needs to know about it. */
export type PayPlanLot = {
  lotId: string;
  /** The account the lot was won for. */
  buyerAccountId: string;
  title: string;
  lotNumber: number | null;
  saleTitle: string | null;
  /** Where the invoice stands (from `purchaseInvoiceState`). */
  invoice: PurchaseInvoiceStatus;
  /** The latest payment row's status; `null` while no payment is raised. */
  paymentStatus: PaymentStatus | null;
  paymentId: string | null;
  invoiceId: string | null;
  /** The invoice was voided. */
  invoiceVoided: boolean;
  /** Whether this payer may pay this lot (`buyerPaymentAuthority`). */
  payerMayPay: boolean;
  /** Waiting for a finance or compliance review for a reason on the seller's side. */
  heldForReview: boolean;
  /** Already part of another payment that is still open. */
  inPaymentInProgress: boolean;
  /**
   * What the invoice charges: the stored lines of a raised invoice, or the lines it would be
   * raised with now.
   */
  lines: InvoiceLine[];
  /** The stored due date, or the one the invoice would get if raised now. */
  dueAt: Date;
};

type PayPlanRole = PayPlan["payerRole"];

export type PickRefusal = "pay_several_empty" | "pay_several_too_many" | "pay_several_duplicate";

/** The most lots one payment covers. */
export const PAY_PLAN_MAX_LOTS = 20;

/** Why a pick of lots is refused outright, before looking at any of them. */
export function pickRefusal(lotIds: readonly string[]): PickRefusal | null {
  if (lotIds.length === 0) return "pay_several_empty";
  if (lotIds.length > PAY_PLAN_MAX_LOTS) return "pay_several_too_many";
  if (new Set(lotIds).size !== lotIds.length) return "pay_several_duplicate";
  return null;
}

function leftOutReason(
  lot: PayPlanLot,
  accountId: string,
  payerRole: PayPlanRole,
): PayPlanLeftOutReason | null {
  if (lot.buyerAccountId !== accountId) return "other_account";
  if (lot.invoiceVoided) return "voided";
  switch (lot.invoice) {
    case "cancelled":
      return "cancelled";
    case "refunded":
      return "refunded";
    case "paid":
      return "paid";
    case "processing":
      // A payment waiting for a review is held; one the buyer has paid is being confirmed.
      return lot.paymentStatus === "requires_manual_review" ? "held_for_review" : "being_confirmed";
    default:
      break;
  }
  if (!invoiceIsOwed(lot.invoice)) return "being_confirmed";
  // Someone who does not pay for the account still sees its invoices (the gate stops Pay); a
  // payer is told about the lots they may not pay.
  if (payerRole === "payer" && !lot.payerMayPay) return "not_payer";
  if (lot.heldForReview) return "held_for_review";
  if (lot.inPaymentInProgress) return "being_paid";
  return null;
}

export type ClassifiedPayPlanLots = {
  payable: PayPlanPayable[];
  leftOut: { lotId: string; reason: PayPlanLeftOutReason }[];
};

/**
 * Which of the picked lots one payment covers for `accountId`, and why the others are left out.
 * Lots that cannot be paid are left out with a reason rather than failing the whole pick, so a
 * stale page still pays what it can. Lots won for the account but not invoiced yet are included:
 * they are invoiced when the payment starts.
 */
export function classifyPayPlanLots(
  accountId: string,
  lots: readonly PayPlanLot[],
  payerRole: PayPlanRole = "payer",
): ClassifiedPayPlanLots {
  const payable: PayPlanPayable[] = [];
  const leftOut: ClassifiedPayPlanLots["leftOut"] = [];
  for (const lot of lots) {
    const reason = leftOutReason(lot, accountId, payerRole);
    if (reason) {
      leftOut.push({ lotId: lot.lotId, reason });
      continue;
    }
    payable.push({
      lotId: lot.lotId,
      paymentId: lot.paymentId,
      invoiceId: lot.invoiceId,
      title: lot.title,
      lotNumber: lot.lotNumber,
      saleTitle: lot.saleTitle,
      lines: lot.lines,
      totalPence: lot.lines.reduce((sum, line) => sum + line.amountPence, 0),
      dueAt: lot.dueAt.toISOString(),
      overdue: lot.invoice === "overdue",
    });
  }
  return { payable, leftOut };
}

/** A check on the amount that stops the payment, if one does. */
export type PayPlanComplianceHold =
  | { hold: false }
  | {
      hold: true;
      reason: "aml_hold" | "source_of_funds_required";
      subject: "payer" | "winner";
    };

export type PayPlanFacts = {
  account: PayPlan["account"];
  payerRole: PayPlan["payerRole"];
  entity: PayPlan["entity"];
  /** The account has accepted the Conditions and finished onboarding. */
  onboardingComplete: boolean;
  eligibility: PaymentEligibility;
  compliance: PayPlanComplianceHold;
  limits: PaymentTierLimits;
  classified: ClassifiedPayPlanLots;
};

/** The first thing that stops the payment, or clear. The order is part of the contract. */
function payPlanGate(facts: PayPlanFacts, totalPence: number): PayPlanGate {
  if (facts.payerRole === "informed") {
    return { kind: "not_payer", payingAccountName: facts.account.name };
  }
  if (!facts.onboardingComplete) return { kind: "onboarding_required" };
  if (facts.eligibility.kind === "refused") {
    return { kind: "refused", reason: facts.eligibility.reason };
  }
  if (facts.eligibility.kind === "held") return { kind: "held", reason: facts.eligibility.reason };
  if (facts.compliance.hold) {
    return {
      kind: "compliance",
      reason: facts.compliance.reason,
      subject: facts.compliance.subject,
    };
  }
  if (totalPence >= facts.limits.manualReviewMinPence) return { kind: "finance_check" };
  return { kind: "clear" };
}

/**
 * The whole plan for paying lots: what is payable with its stored lines, what is left out and
 * why, the totals, the gate that decides whether Pay is offered, and how the total can be paid.
 * Pure: every fact is read by the caller. A gate other than `clear` still lists the lots.
 */
export function buildPayPlan(facts: PayPlanFacts): PayPlan {
  const { payable, leftOut } = facts.classified;
  const totalPence = payable.reduce((sum, p) => sum + p.totalPence, 0);

  const byKind = new Map<string, number>();
  for (const p of payable) {
    for (const line of p.lines)
      byKind.set(line.kind, (byKind.get(line.kind) ?? 0) + line.amountPence);
  }
  const dueTimes = payable.map((p) => Date.parse(p.dueAt));
  const firstDue = dueTimes.length > 0 ? Math.min(...dueTimes) : null;

  return {
    account: facts.account,
    payerRole: facts.payerRole,
    entity: facts.entity,
    gate: payPlanGate(facts, totalPence),
    payable,
    leftOut,
    totals: {
      pence: totalPence,
      byKind: invoiceLineKinds.flatMap((kind) => {
        const pence = byKind.get(kind);
        return pence === undefined ? [] : [{ kind, pence }];
      }),
    },
    firstDueAt: firstDue === null ? null : new Date(firstDue).toISOString(),
    methods: paymentMethodsFor(totalPence, facts.limits),
    currency: "GBP",
  };
}
