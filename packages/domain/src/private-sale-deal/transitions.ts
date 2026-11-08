import type {
  PrivateSaleDealDetail,
  PrivateSaleDealStage,
  PrivateSalePartyRole,
  PrivateSaleStageChange,
  PrivateSaleStageChanges,
} from "@auction/types";
import type { DealBlocker } from "./blockers.js";
import {
  type DealClearanceSnapshot,
  type PartyClearance,
  sourceOfFundsRequired,
} from "./clearance.js";
import type { PrivateSalePolicy } from "./policy.js";
import type { TermsAcceptance } from "./terms.js";

/** The moves a deal can make. Each is one row of {@link DEAL_TRANSITIONS}. */
export type DealCommand =
  | "open_offer"
  | "agree"
  | "clear"
  | "issue_invoice"
  | "mark_paid"
  | "release"
  | "settle"
  | "cancel";

/** The part of a deal the rules read. */
export type DealSnapshot = Pick<
  PrivateSaleDealDetail,
  "stage" | "priceMinor" | "sellerCommissionBps" | "vatTreatment" | "agreedByUserId" | "buyer"
>;

/** What a move reads besides the deal: who, when, the configuration and the checks. */
export type DealTransitionContext = {
  /** `null` when the system makes the move, such as clearing a deal when its checks pass. */
  actorUserId: string | null;
  now: Date;
  policy: PrivateSalePolicy;
  clearance: DealClearanceSnapshot;
  termsAcceptance: TermsAcceptance;
  cancelReason?: string;
  /** Set by the refund flow once a paid deal's money has been returned. */
  refundRecorded?: boolean;
};

type Guard = (deal: DealSnapshot, ctx: DealTransitionContext) => DealBlocker[];

type TransitionRow = {
  from: readonly PrivateSaleDealStage[];
  to: PrivateSaleDealStage;
  guards: readonly Guard[];
  /** Fields the move writes to the deal. */
  changes?: (deal: DealSnapshot, ctx: DealTransitionContext) => PrivateSaleStageChanges;
};

const ROLES: readonly PrivateSalePartyRole[] = ["seller", "buyer"];

// ---- Guards: each answers one question and reports every reason it fails.

const buyerNamed: Guard = (deal) => (deal.buyer ? [] : [{ code: "buyer_not_named" }]);

const priceSet: Guard = (deal) =>
  deal.priceMinor !== null && deal.priceMinor > 0 ? [] : [{ code: "price_not_set" }];

/** Both parties' identity and AML screening are clear. A party without an account blocks too. */
const partiesCleared: Guard = (deal, ctx) => {
  const blockers: DealBlocker[] = [];
  for (const role of ROLES) {
    const party: PartyClearance | null = ctx.clearance[role];
    if (role === "buyer" && !deal.buyer) continue; // reported by buyerNamed
    if (!party) {
      blockers.push({ code: "party_missing", party: role });
      continue;
    }
    if (party.kyc !== "clear") blockers.push({ code: "kyc_not_clear", party: role });
    if (party.aml !== "clear") blockers.push({ code: "aml_not_clear", party: role });
  }
  return blockers;
};

const termsAccepted: Guard = (deal, ctx) => {
  if (ctx.policy.termsVersion === null) return [{ code: "terms_version_not_configured" }];
  return ROLES.filter((role) => (role === "buyer" ? deal.buyer : true))
    .filter((role) => !ctx.termsAcceptance[role])
    .map((role) => ({ code: "terms_not_accepted" as const, party: role }));
};

/** Source of funds approved, when the price with the buyer's other open deals reaches the threshold. */
const sourceOfFundsSatisfied: Guard = (deal, ctx) => {
  if (deal.priceMinor === null) return [];
  const required = sourceOfFundsRequired({
    priceMinor: deal.priceMinor,
    buyerOtherOpenExposureMinor: ctx.clearance.buyerOtherOpenExposureMinor,
    thresholdMinor: ctx.policy.sourceOfFundsThresholdMinor,
  });
  return required && ctx.clearance.buyerSourceOfFunds !== "approved"
    ? [{ code: "source_of_funds_not_satisfied" }]
    : [];
};

/** A VAT treatment from the configured list. */
const vatTreatmentChosen: Guard = (deal, ctx) => {
  if (ctx.policy.vatTreatments.length === 0) return [{ code: "vat_treatments_not_configured" }];
  if (deal.vatTreatment === null) return [{ code: "vat_treatment_not_chosen" }];
  return ctx.policy.vatTreatments.some((t) => t.code === deal.vatTreatment)
    ? []
    : [{ code: "vat_treatment_not_allowed" }];
};

const commissionSet: Guard = (deal) =>
  deal.sellerCommissionBps === null ? [{ code: "commission_not_set" }] : [];

/** The commission rate must be configured in policy, not just typed on the deal. */
const commissionRateConfigured: Guard = (_deal, ctx) =>
  ctx.policy.commissionRateBps === null ? [{ code: "commission_rate_not_configured" }] : [];

const termsVersionConfigured: Guard = (_deal, ctx) =>
  ctx.policy.termsVersion === null ? [{ code: "terms_version_not_configured" }] : [];

const paymentDeadlineConfigured: Guard = (_deal, ctx) =>
  ctx.policy.paymentDueDays === null ? [{ code: "payment_due_days_not_configured" }] : [];

/** The person who recorded the agreement cannot also issue the invoice for the same deal. */
const differentPersonInvoices: Guard = (deal, ctx) =>
  ctx.actorUserId !== null && ctx.actorUserId === deal.agreedByUserId
    ? [{ code: "same_person_agreed_and_invoiced" }]
    : [];

const cancelHasReason: Guard = (_deal, ctx) =>
  (ctx.cancelReason ?? "").trim() === "" ? [{ code: "cancel_reason_required" }] : [];

/** A paid deal is cancelled only after the buyer has been refunded. */
const paidDealRefunded: Guard = (deal, ctx) =>
  (deal.stage === "paid" || deal.stage === "released") && !ctx.refundRecorded
    ? [{ code: "refund_not_recorded" }]
    : [];

const addDays = (from: Date, days: number): Date => new Date(from.getTime() + days * 86_400_000);

/**
 * Every move a deal can make, and what stands in its way. Open/closed: a new move is a new row,
 * and a new rule is a new guard, with no change to the code that runs them.
 */
export const DEAL_TRANSITIONS: Readonly<Record<DealCommand, TransitionRow>> = {
  open_offer: { from: ["proposed"], to: "offer", guards: [buyerNamed] },
  agree: {
    from: ["offer"],
    to: "agreed",
    // The commission is part of what the seller accepts, so it is set before the price is agreed.
    guards: [buyerNamed, priceSet, commissionSet, partiesCleared, termsAccepted],
    changes: (_deal, ctx) => ({ agreedAt: ctx.now, agreedByUserId: ctx.actorUserId }),
  },
  clear: {
    from: ["agreed"],
    to: "cleared",
    guards: [partiesCleared, sourceOfFundsSatisfied],
  },
  issue_invoice: {
    from: ["cleared"],
    to: "invoiced",
    guards: [
      partiesCleared,
      sourceOfFundsSatisfied,
      vatTreatmentChosen,
      commissionSet,
      commissionRateConfigured,
      termsVersionConfigured,
      paymentDeadlineConfigured,
      differentPersonInvoices,
    ],
    changes: (_deal, ctx) => ({
      invoicedByUserId: ctx.actorUserId,
      // Guarded above: the days are configured whenever this runs.
      paymentDueAt: addDays(ctx.now, ctx.policy.paymentDueDays ?? 0),
    }),
  },
  mark_paid: {
    from: ["invoiced"],
    to: "paid",
    guards: [],
    changes: (_deal, ctx) =>
      ctx.policy.collectionDueDays === null
        ? {}
        : { collectionDueAt: addDays(ctx.now, ctx.policy.collectionDueDays) },
  },
  release: { from: ["paid"], to: "released", guards: [] },
  settle: { from: ["released"], to: "settled", guards: [] },
  cancel: {
    from: ["proposed", "offer", "agreed", "cleared", "invoiced", "paid", "released"],
    to: "cancelled",
    guards: [cancelHasReason, paidDealRefunded],
    changes: (_deal, ctx) => ({
      cancelReason: (ctx.cancelReason ?? "").trim(),
      cancelledAt: ctx.now,
    }),
  },
};

export type DealTransitionResult =
  | { ok: true; change: PrivateSaleStageChange }
  | { ok: false; blockers: DealBlocker[] };

/** Everything that stands in the way of a move, or nothing when it can be made. */
export function dealBlockers(
  deal: DealSnapshot,
  command: DealCommand,
  ctx: DealTransitionContext,
): DealBlocker[] {
  const row = DEAL_TRANSITIONS[command];
  if (!row.from.includes(deal.stage)) return [{ code: "invalid_transition" }];
  return row.guards.flatMap((guard) => guard(deal, ctx));
}

/** Makes a move if the deal may make it. A pure function: it writes nothing and reads no records. */
export function transitionDeal(
  deal: DealSnapshot,
  command: DealCommand,
  ctx: DealTransitionContext,
): DealTransitionResult {
  const blockers = dealBlockers(deal, command, ctx);
  if (blockers.length > 0) return { ok: false, blockers };
  const row = DEAL_TRANSITIONS[command];
  return {
    ok: true,
    change: {
      from: deal.stage,
      to: row.to,
      actorUserId: ctx.actorUserId,
      reason: command === "cancel" ? (ctx.cancelReason ?? "").trim() : null,
      changes: row.changes?.(deal, ctx) ?? {},
    },
  };
}

/** The moves available from a stage, in table order, for a screen to offer. */
export function dealCommandsFrom(stage: PrivateSaleDealStage): DealCommand[] {
  return (Object.keys(DEAL_TRANSITIONS) as DealCommand[]).filter((command) =>
    DEAL_TRANSITIONS[command].from.includes(stage),
  );
}
