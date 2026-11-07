import { formatLondonDayMonth, formatLondonWeekday } from "@/lib/datetime/london-time";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { PurchaseBadge } from "@/lib/purchases/purchase-standing";
import type {
  InvoiceLine,
  PayPlan,
  PayPlanGate,
  PayPlanLeftOutReason,
  PayPlanPayable,
} from "@auction/types";
import { formatGbp } from "@auction/ui";
import type { NoticeTone } from "@auction/ui/lax";
import { GATE_COPY, INVOICE_LINE_KIND_LABEL, LEFT_OUT_REASON_COPY, PAY_COPY } from "./pay-copy";

/** What the page is showing, which decides its layout and whether Pay is offered at all. */
export type PayState =
  /** Invoices to pay and nothing in the way: Pay is offered. */
  | "ready"
  /** A check stands in the way: the money is shown with the next step, never a Pay button. */
  | "held"
  /** The account's owners, admins and finance team pay; the reader is told, not asked. */
  | "informed"
  /** Every invoice is being paid or the payment is being confirmed. */
  | "confirming"
  /** Nothing can be paid from this link. */
  | "empty";

export type PayNotice = {
  tone: NoticeTone;
  title: string;
  detail?: string;
  /** A link to the one step that clears the notice. */
  action?: { label: string; href: string };
};

export type PayLine = { label: string; amount: string };

export type PayLotVm = {
  lotId: string;
  title: string;
  image: string | null;
  /**
   * What only a payment of several lots needs to say about each: the lot's reference, the day it
   * is due and its invoice total. For a single lot the title row and the payment panel say them
   * once, so they are `null` here.
   */
  detail: { subtitle: string; due: string; total: string } | null;
  /** The purchase page of the lot. */
  href: string;
};

/** What the purchases read knows about a lot that the plan does not. */
export type PayLotDetails = { image: string | null; wonAt: Date | null; wonBy: string | null };

/** What the page needs besides the plan. */
export type PayVmContext = {
  /** This page's own address, for the steps that return to it. */
  returnTo: string;
  /** Where "Contact settlements" goes. */
  contactHref: string;
  /** The payment page sent the person back without paying. */
  returned: "cancelled" | null;
  details: Readonly<Record<string, PayLotDetails>>;
};

export type PayMoneyVm = {
  lines: PayLine[];
  totalLabel: string;
  total: string;
  /** "Due by Fri 13 Nov" for one invoice, the earliest date for several. */
  due: string;
  /** The company that issues the invoices: "Invoice from London Auction Xchange LTD, 156 …". */
  company: string;
  registration: string[];
};

/** The one thing the rail and the phone bar offer. */
export type PayAction =
  | {
      kind: "pay";
      label: string;
      /** The label where the total is already beside the button (the phone bar). */
      barLabel: string;
      /** The lots and the total (whole pence) that were shown: all the server is asked to charge. */
      lotIds: string[];
      expectedTotalPence: number;
    }
  | { kind: "link"; label: string; href: string };

export type PayEmptyVm = {
  illustration: "parcel" | "lock";
  title: string;
  description: string;
  action: { label: string; href: string };
};

export type PayPageVm = {
  state: PayState;
  title: string;
  subtitle: string | null;
  badge: PurchaseBadge | null;
  /** In reading order: the check in the way first, then what was left out. */
  notices: PayNotice[];
  lots: PayLotVm[];
  money: PayMoneyVm | null;
  /** How the payment is taken, said once, only while Pay is offered. */
  howYouPay: string[];
  action: PayAction | null;
  /** A Pay button that cannot be pressed yet, with why (the desktop rail while identity is open). */
  railPay: { label: string; reason: string } | null;
  /** The sentence under the action. */
  actionNote: string | null;
  /** A way back to where the person came from. */
  back: { label: string; href: string } | null;
  empty: PayEmptyVm | null;
};

const PURCHASES_LINK = { label: PAY_COPY.openPurchases, href: CLIENT_ROUTES.purchases } as const;

function dayLabel(iso: string, now: Date): string {
  const date = new Date(iso);
  return `${formatLondonWeekday(date)} ${formatLondonDayMonth(date, now)}`;
}

function lotSubtitle(payable: PayPlanPayable): string {
  return [payable.lotNumber === null ? null : `Lot ${payable.lotNumber}`, payable.saleTitle]
    .filter((part): part is string => Boolean(part))
    .join(" · ");
}

function lineVm(line: InvoiceLine): PayLine {
  return { label: line.label, amount: formatGbp(line.amountPence) };
}

function lotVm(
  payable: PayPlanPayable,
  now: Date,
  several: boolean,
  details: PayVmContext["details"],
): PayLotVm {
  const due = dayLabel(payable.dueAt, now);
  return {
    lotId: payable.lotId,
    title: payable.title,
    image: details[payable.lotId]?.image ?? null,
    detail: several
      ? {
          subtitle: lotSubtitle(payable),
          due: payable.overdue ? PAY_COPY.wasDue(due) : PAY_COPY.dueBy(due),
          total: formatGbp(payable.totalPence),
        }
      : null,
    href: `${CLIENT_ROUTES.purchases}/${payable.lotId}`,
  };
}

/** The invoice's own lines for one lot, the lines summed per kind for several. */
function moneyLines(plan: PayPlan): PayLine[] {
  const [only] = plan.payable;
  if (plan.payable.length === 1 && only) return only.lines.map(lineVm);
  return plan.totals.byKind.map((entry) => ({
    label: INVOICE_LINE_KIND_LABEL[entry.kind],
    amount: formatGbp(entry.pence),
  }));
}

function moneyVm(plan: PayPlan, now: Date, totalLabel: string): PayMoneyVm | null {
  if (plan.payable.length === 0 || plan.firstDueAt === null) return null;
  const overdue = plan.payable.some((p) => p.overdue);
  const due = dayLabel(plan.firstDueAt, now);
  const { entity } = plan;
  return {
    lines: moneyLines(plan),
    totalLabel,
    total: formatGbp(plan.totals.pence),
    due: overdue ? PAY_COPY.wasDue(due) : PAY_COPY.dueBy(due),
    company: PAY_COPY.invoiceFrom(entity.name, entity.address),
    registration: [
      entity.companyNumber ? `Company number ${entity.companyNumber}` : null,
      entity.vatNumber ? `VAT number ${entity.vatNumber}` : null,
    ].filter((part): part is string => part !== null),
  };
}

function heading(
  plan: PayPlan,
  now: Date,
  details: PayVmContext["details"],
): { title: string; subtitle: string | null } {
  const [only] = plan.payable;
  const organisation = plan.account.kind === "organisation" ? plan.account.name : null;
  if (plan.payable.length === 0) return { title: PAY_COPY.titleEmpty, subtitle: null };
  if (plan.payable.length === 1 && only) {
    const known = details[only.lotId];
    const wonAt = known?.wonAt ? PAY_COPY.wonOn(dayLabel(known.wonAt.toISOString(), now)) : null;
    const who = !organisation
      ? null
      : known?.wonBy
        ? PAY_COPY.wonByFor(known.wonBy, organisation)
        : PAY_COPY.payingFor(organisation);
    return {
      title: PAY_COPY.titleOne(only.title),
      subtitle:
        [lotSubtitle(only), wonAt, who]
          .filter((part): part is string => Boolean(part))
          .join(" · ") || null,
    };
  }
  return {
    title: PAY_COPY.titleSeveral(plan.payable.length),
    subtitle: [
      PAY_COPY.severalSubtitle(plan.payable.length),
      organisation ? PAY_COPY.payingFor(organisation) : null,
    ]
      .filter((part): part is string => Boolean(part))
      .join(" · "),
  };
}

function readyBadge(plan: PayPlan, now: Date): PurchaseBadge {
  const first = dayLabel(plan.firstDueAt ?? now.toISOString(), now);
  if (plan.payable.some((p) => p.overdue)) {
    return { label: PAY_COPY.badgeOverdue(first), tone: "danger", shape: "alert" };
  }
  return {
    label: plan.payable.length > 1 ? PAY_COPY.badgeFirstDue(first) : PAY_COPY.badgeDue(first),
    tone: "warning",
    shape: "dot",
  };
}

/** What a check that stands in the way says and where it sends the reader. */
type GateOutcome = { badge: PurchaseBadge; notice: PayNotice };

const WARNING_ALERT = { tone: "warning", shape: "alert" } as const;

function gateOutcome(
  gate: Exclude<PayPlanGate, { kind: "clear" | "not_payer" }>,
  returnTo: string,
): GateOutcome {
  switch (gate.kind) {
    case "onboarding_required":
      return {
        badge: { label: PAY_COPY.setupBadge, ...WARNING_ALERT },
        notice: {
          tone: "warning",
          title: GATE_COPY.onboarding.title,
          detail: GATE_COPY.onboarding.detail,
          action: {
            label: GATE_COPY.onboarding.action,
            href: `/onboarding/account?next=${encodeURIComponent(returnTo)}`,
          },
        },
      };
    case "refused":
      return {
        badge: { label: PAY_COPY.unavailableBadge, tone: "neutral", shape: "ring" },
        notice: {
          tone: "danger",
          title: GATE_COPY.organisationClosed.title,
          detail: GATE_COPY.organisationClosed.detail,
          action: { label: GATE_COPY.organisationClosed.action, href: "/contact" },
        },
      };
    case "held":
      return gate.reason === "identity_verification_required"
        ? {
            badge: { label: PAY_COPY.identityBadge, ...WARNING_ALERT },
            notice: {
              tone: "warning",
              title: GATE_COPY.identity.title,
              detail: `${GATE_COPY.identity.detail} ${GATE_COPY.identity.after}`,
              action: {
                label: GATE_COPY.identity.action,
                href: `${CLIENT_ROUTES.verifyIdentity}?next=${encodeURIComponent(returnTo)}`,
              },
            },
          }
        : {
            badge: { label: PAY_COPY.inReviewBadge, ...WARNING_ALERT },
            notice: {
              tone: "warning",
              title: GATE_COPY.organisationUnderReview.title,
              detail: GATE_COPY.organisationUnderReview.detail,
            },
          };
    case "compliance":
      // The payer can act on their own check; a check on the person who won is ours to finish.
      if (gate.reason === "source_of_funds_required" && gate.subject === "payer") {
        return {
          badge: { label: PAY_COPY.inReviewBadge, ...WARNING_ALERT },
          notice: {
            tone: "warning",
            title: GATE_COPY.sourceOfFunds.title,
            detail: GATE_COPY.sourceOfFunds.detail,
            action: {
              label: GATE_COPY.sourceOfFunds.action,
              href: CLIENT_ROUTES.sourceOfFunds,
            },
          },
        };
      }
      return {
        badge: { label: PAY_COPY.inReviewBadge, ...WARNING_ALERT },
        notice: {
          tone: "warning",
          title: gate.subject === "payer" ? GATE_COPY.amlHold.title : GATE_COPY.buyerCheck.title,
          detail: GATE_COPY.amlHold.detail,
        },
      };
    case "finance_check":
      return {
        badge: { label: PAY_COPY.financeCheckBadge, ...WARNING_ALERT },
        notice: {
          tone: "warning",
          title: GATE_COPY.financeCheck.title,
          detail: GATE_COPY.financeCheck.detail,
        },
      };
  }
}

/** "1 was won for another account. 2 are already paid." */
function leftOutDetail(leftOut: PayPlan["leftOut"]): string {
  const counts = new Map<PayPlanLeftOutReason, number>();
  for (const entry of leftOut) counts.set(entry.reason, (counts.get(entry.reason) ?? 0) + 1);
  return [...counts]
    .map(([reason, count]) => {
      const copy = LEFT_OUT_REASON_COPY[reason];
      return `${count} ${count === 1 ? copy.one : copy.many}.`;
    })
    .join(" ");
}

function leftOutNotice(leftOut: PayPlan["leftOut"]): PayNotice | null {
  if (leftOut.length === 0) return null;
  const one = leftOut.length === 1;
  // The usual case of a link with someone else's lot in it has its own approved wording.
  if (leftOut.every((entry) => entry.reason === "other_account" || entry.reason === "paid")) {
    return {
      tone: "info",
      title: one ? PAY_COPY.notYoursOne : PAY_COPY.notYoursMany(leftOut.length),
      detail: one ? PAY_COPY.notYoursDetailOne : PAY_COPY.notYoursDetailMany,
    };
  }
  return {
    tone: "info",
    title: one
      ? "One lot in this link isn't in this payment"
      : `${leftOut.length} lots in this link aren't in this payment`,
    detail: `${leftOutDetail(leftOut)} The rest are below.`,
  };
}

function has(leftOut: PayPlan["leftOut"], ...reasons: PayPlanLeftOutReason[]): boolean {
  return leftOut.some((entry) => reasons.includes(entry.reason));
}

/** The page with nothing on it yet: each state fills in what it shows. */
export function blankPayVm(): PayPageVm {
  return {
    state: "empty",
    title: PAY_COPY.titleEmpty,
    subtitle: null,
    badge: null,
    notices: [],
    lots: [],
    money: null,
    howYouPay: [],
    action: null,
    railPay: null,
    actionNote: null,
    back: null,
    empty: null,
  };
}

/** What an empty page says, by why the lots are not payable. */
function emptyDescription(leftOut: PayPlan["leftOut"]): string {
  const only = (reason: PayPlanLeftOutReason) => leftOut.every((entry) => entry.reason === reason);
  if (leftOut.length === 0) return PAY_COPY.emptyNotYours;
  if (only("paid")) return PAY_COPY.emptyAllPaid;
  if (only("cancelled")) return PAY_COPY.emptyCancelled;
  if (only("voided")) return PAY_COPY.emptyVoided;
  if (only("refunded")) return PAY_COPY.emptyRefunded;
  if (has(leftOut, "other_account")) return PAY_COPY.emptyNotYours;
  return PAY_COPY.emptyDone;
}

/** The page when no lot of the link can be paid now: why, in one state. */
function nothingPayable(plan: PayPlan, returnTo: string): PayPageVm {
  const base = blankPayVm();
  if (has(plan.leftOut, "being_confirmed")) {
    return {
      ...base,
      state: "confirming",
      badge: { label: PAY_COPY.confirmingBadge, tone: "info", shape: "dot" },
      notices: [
        {
          tone: "info",
          title: PAY_COPY.confirmingTitle,
          detail: PAY_COPY.confirmingBody,
          action: { label: PAY_COPY.refresh, href: returnTo },
        },
      ],
    };
  }
  if (has(plan.leftOut, "being_paid")) {
    // Another payment holds these lots: not a payment being confirmed, so it says only that.
    return {
      ...base,
      state: "confirming",
      badge: { label: PAY_COPY.openBadge, tone: "info", shape: "dot" },
      notices: [
        {
          tone: "info",
          title: PAY_COPY.openTitle,
          detail: PAY_COPY.openBody,
          action: { label: PAY_COPY.refresh, href: returnTo },
        },
      ],
    };
  }
  if (has(plan.leftOut, "held_for_review")) {
    return {
      ...base,
      state: "held",
      badge: { label: PAY_COPY.inReviewBadge, ...WARNING_ALERT },
      notices: [
        {
          tone: "warning",
          title: GATE_COPY.heldForReview.title,
          detail: GATE_COPY.heldForReview.detail,
          action: PURCHASES_LINK,
        },
      ],
    };
  }
  if (has(plan.leftOut, "not_payer")) {
    return {
      ...base,
      state: "informed",
      badge: { label: PAY_COPY.awaitingBadge, tone: "neutral", shape: "ring" },
      notices: [
        {
          tone: "info",
          title: GATE_COPY.notPayer.title,
          detail: GATE_COPY.notPayer.detail,
          action: PURCHASES_LINK,
        },
      ],
    };
  }
  return {
    ...base,
    empty: {
      illustration: "parcel",
      title: PAY_COPY.emptyTitle,
      description: emptyDescription(plan.leftOut),
      action: PURCHASES_LINK,
    },
  };
}

/** How the total is taken: the method the server says is open for it, with what to tell the payer. */
type OpenMethod = { method: "card" | "bank_transfer"; how: string[] };

function openMethod(plan: PayPlan): OpenMethod | null {
  const open = (method: OpenMethod["method"]) =>
    plan.methods.some((m) => m.method === method && m.available);
  if (open("card")) return { method: "card", how: [PAY_COPY.card] };
  if (open("bank_transfer")) {
    return { method: "bank_transfer", how: [PAY_COPY.bankTransfer, PAY_COPY.cardLimit] };
  }
  return null;
}

function payLabels(
  method: OpenMethod["method"],
  total: string,
  organisation: string | null,
): { label: string; barLabel: string } {
  if (method === "bank_transfer") {
    return { label: PAY_COPY.continueToBankTransfer, barLabel: PAY_COPY.continueBar };
  }
  return {
    label: organisation
      ? PAY_COPY.payForOrganisation(total, organisation)
      : PAY_COPY.payLabel(total),
    barLabel: PAY_COPY.payBar,
  };
}

function payActionFor(plan: PayPlan): {
  action: PayAction | null;
  how: string[];
  notice: PayNotice | null;
} {
  const method = openMethod(plan);
  if (!method) {
    // The total is more than one online payment takes: say so, offer no way to pay it.
    return { action: null, how: [], notice: { tone: "warning", title: PAY_COPY.overOnlineLimit } };
  }
  const organisation = plan.account.kind === "organisation" ? plan.account.name : null;
  return {
    action: {
      kind: "pay",
      ...payLabels(method.method, formatGbp(plan.totals.pence), organisation),
      lotIds: plan.payable.map((p) => p.lotId),
      expectedTotalPence: plan.totals.pence,
    },
    how: method.how,
    notice: null,
  };
}

/** The notice for a payment the payment page sent the person back from. */
function returnedNotice(returned: PayVmContext["returned"]): PayNotice[] {
  return returned === "cancelled"
    ? [{ tone: "danger", title: PAY_COPY.notCompletedTitle, detail: PAY_COPY.notCompletedBody }]
    : [];
}

/** The overdue invoice's notice: factual, with the date and an offer of help, no consequences. */
function overdueNotice(plan: PayPlan, now: Date, contactHref: string): PayNotice[] {
  if (!plan.payable.some((p) => p.overdue) || plan.firstDueAt === null) return [];
  return [
    {
      tone: "danger",
      title: PAY_COPY.overdueTitle(dayLabel(plan.firstDueAt, now)),
      detail: PAY_COPY.overdueBody,
      action: { label: PAY_COPY.contactSettlements, href: contactHref },
    },
  ];
}

/**
 * Everything the Pay page shows, from the server's plan alone. The figures are the plan's, only
 * formatted; nothing is added up here. A check that stands in the way leaves no way to pay: the
 * action becomes the one step that clears it.
 */
export function buildPayPageVm(plan: PayPlan, now: Date, context: PayVmContext): PayPageVm {
  const { returnTo, details } = context;
  const returned = returnedNotice(context.returned);
  if (plan.payable.length === 0) {
    const vm = nothingPayable(plan, returnTo);
    return { ...vm, notices: [...returned, ...vm.notices] };
  }

  const several = plan.payable.length > 1;
  const { title, subtitle } = heading(plan, now, details);
  const [only] = plan.payable;
  const leftOut = leftOutNotice(plan.leftOut);
  const common = {
    title,
    subtitle,
    lots: plan.payable.map((p) => lotVm(p, now, several, details)),
    empty: null,
    actionNote: null,
    howYouPay: [] as string[],
    railPay: null as PayPageVm["railPay"],
    back:
      !several && only
        ? { label: PAY_COPY.backToPurchase, href: `${CLIENT_ROUTES.purchases}/${only.lotId}` }
        : { label: PAY_COPY.backToPurchases, href: CLIENT_ROUTES.purchases },
  };

  if (plan.gate.kind === "not_payer") {
    const copy = GATE_COPY.informed(plan.gate.payingAccountName);
    return {
      ...common,
      state: "informed",
      badge: { label: PAY_COPY.awaitingBadge, tone: "neutral", shape: "ring" },
      notices: [
        ...returned,
        { tone: "info", title: copy.title, detail: copy.detail },
        ...(leftOut ? [leftOut] : []),
      ],
      money: moneyVm(plan, now, PAY_COPY.totalToPay),
      action: null,
    };
  }

  if (plan.gate.kind !== "clear") {
    const outcome = gateOutcome(plan.gate, returnTo);
    const identity =
      plan.gate.kind === "held" && plan.gate.reason === "identity_verification_required";
    return {
      ...common,
      state: "held",
      badge: outcome.badge,
      notices: [...returned, outcome.notice, ...(leftOut ? [leftOut] : [])],
      money: moneyVm(plan, now, PAY_COPY.totalToPay),
      railPay: identity
        ? { label: PAY_COPY.payLabel(formatGbp(plan.totals.pence)), reason: PAY_COPY.verifyToPay }
        : null,
      action: outcome.notice.action
        ? { kind: "link", label: outcome.notice.action.label, href: outcome.notice.action.href }
        : null,
    };
  }

  const pay = payActionFor(plan);
  return {
    ...common,
    state: "ready",
    badge: readyBadge(plan, now),
    notices: [
      ...returned,
      ...overdueNotice(plan, now, context.contactHref),
      ...(pay.notice ? [pay.notice] : []),
      ...(leftOut ? [leftOut] : []),
    ],
    money: moneyVm(plan, now, PAY_COPY.totalToPay),
    howYouPay: pay.how,
    action: pay.action,
    actionNote: pay.action ? PAY_COPY.underButton : null,
  };
}
