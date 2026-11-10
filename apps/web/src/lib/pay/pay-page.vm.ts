import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { PurchaseBadge } from "@/lib/purchases/purchase-standing";
import { LONDON_TIME_ZONE, formatDayMonth, formatWeekday } from "@auction/datetime";
import type {
  InvoiceLine,
  PayPlan,
  PayPlanGate,
  PayPlanLeftOutReason,
  PayPlanPayable,
  PayPlanProgress,
} from "@auction/types";
import { formatGbp } from "@auction/ui";
import type { NoticeTone } from "@auction/ui/lax";
import { GATE_COPY, INVOICE_LINE_KIND_LABEL, LEFT_OUT_REASON_COPY, PAY_COPY } from "./pay-copy";
import { type PayMethod, type PayMethodsVm, payMethodsVm } from "./pay-methods";

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
  /** A bank transfer is waiting for its money, in whole or in part. */
  | "transfer"
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

/** One lot's delivery in the payment: a courier quote joining it, or a choice still to make. */
export type PayDeliveryRowVm = {
  lotId: string;
  title: string;
  /** Where the courier delivers, and what the price covers; `null` for a choice made after paying. */
  detail: string | null;
  badge: { label: string; tone: "info" | "neutral"; shape: "dot" | "ring" };
};

/** What the Delivery panel says: a row for each lot, a sentence under them and a way to a quote. */
export type PayDeliveryVm = {
  rows: PayDeliveryRowVm[];
  note: string;
  /** Where to get a courier quote before paying, while one can still join this payment. */
  quoteLink: { before: string; label: string; after: string; href: string } | null;
};

export type PayLotVm = {
  lotId: string;
  title: string;
  image: string | null;
  /**
   * What only a payment of several lots needs to say about each: the lot's reference, the day it
   * is due and its invoice total. For a single lot the title row and the payment panel say them
   * once, so they are `null` here. `note` is the day it is due, or where the payment stands.
   */
  detail: { subtitle: string; note: string; total: string } | null;
  /** The purchase page of the lot. */
  href: string;
};

/** What the purchases read knows about a lot that the plan does not. */
export type PayLotDetails = { image: string | null; wonAt: Date | null; wonBy: string | null };

/** One line of the bank details, with what copying it puts on the clipboard. */
export type BankDetailRow = {
  label: string;
  value: string;
  /** What the copy button copies; `null` for a row that is only read. */
  copy: string | null;
};

/** What the page needs to run a payment that is under way. */
export type PayProgressVm = {
  stage: PayPlanProgress["stage"];
  /** Changes whenever the payment moves; the page reads the server's again when it differs. */
  signature: string;
  lotIds: string[];
  refreshHref: string;
  contactHref: string;
  /** The account details to send to, or `null` for a card payment or when they could not be read. */
  details: { rows: BankDetailRow[] } | null;
  /** The details were wanted (a transfer) but the provider could not give them. */
  detailsUnavailable: boolean;
};

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
  /** "Due by Fri 13 Nov" for one invoice, the earliest date for several; `null` once paid for. */
  due: string | null;
  /** The company that issues the invoices: "Invoice from London Auction Xchange LTD, 156 …". */
  company: string;
  registration: string[];
  /** How much of a bank transfer has arrived, as a labelled bar. */
  meter: { percent: number; label: string; caption: string } | null;
};

/** What the one action says for a chosen method. */
export type PayMethodAction = {
  label: string;
  /** The label where the total is already beside the button (the phone bar). */
  barLabel: string;
  /** The sentence under the action. */
  note: string;
  /**
   * Words for the same action after a payment page was left without paying. The page keeps using
   * them while it shows the not-completed note, even after the address has been cleaned and the
   * plan read again without the return.
   */
  retry?: { label: string; barLabel: string };
};

/** The one thing the rail and the phone bar offer. */
export type PayAction =
  | {
      kind: "pay";
      /** What the action says for each way to pay; the person's choice picks one. */
      byMethod: Record<PayMethod, PayMethodAction>;
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
  /** How each lot is delivered, with any courier quote that joins the payment. */
  delivery: PayDeliveryVm | null;
  /** The choice of how to pay, only while Pay is offered. */
  methods: PayMethodsVm | null;
  action: PayAction | null;
  /** A Pay button that cannot be pressed yet, with why (the desktop rail while identity is open). */
  railPay: { label: string; reason: string } | null;
  /** A payment already under way: confirming, or a bank transfer waiting for its money. */
  progress: PayProgressVm | null;
  /**
   * The payment page sent the person back without paying: the note to show once, and this page's
   * clean address to replace the URL with so a refresh does not show it again.
   */
  returned: { title: string; detail: string; cleanHref: string } | null;
  /** A way back to where the person came from. */
  back: { label: string; href: string } | null;
  empty: PayEmptyVm | null;
};

const PURCHASES_LINK = { label: PAY_COPY.openPurchases, href: CLIENT_ROUTES.purchases } as const;

function dayLabel(iso: string, now: Date): string {
  const date = new Date(iso);
  return `${formatWeekday(date, LONDON_TIME_ZONE)} ${formatDayMonth(date, LONDON_TIME_ZONE, now)}`;
}

export function lotSubtitle(payable: Pick<PayPlanPayable, "lotNumber" | "saleTitle">): string {
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
          note: payable.overdue ? PAY_COPY.wasDue(due) : PAY_COPY.dueBy(due),
          total: formatGbp(payable.totalPence),
        }
      : null,
    href: `${CLIENT_ROUTES.purchases}/${payable.lotId}`,
  };
}

/** The courier quotes that join the payment, each as its own line after the invoice's. */
function deliveryLines(plan: PayPlan): PayLine[] {
  const several = plan.payable.length > 1;
  return plan.delivery.map((charge) => {
    const lot = plan.payable.find((p) => p.lotId === charge.lotId);
    return {
      label: several && lot ? PAY_COPY.deliveryLineFor(lot.title) : PAY_COPY.deliveryLine,
      amount: formatGbp(charge.amountPence),
    };
  });
}

/** The invoice's own lines for one lot, the lines summed per kind for several, then any delivery. */
function moneyLines(plan: PayPlan): PayLine[] {
  const [only] = plan.payable;
  const invoice =
    plan.payable.length === 1 && only
      ? only.lines.map(lineVm)
      : plan.totals.byKind.map((entry) => ({
          label: INVOICE_LINE_KIND_LABEL[entry.kind],
          amount: formatGbp(entry.pence),
        }));
  return [...invoice, ...deliveryLines(plan)];
}

/**
 * How each lot is delivered. A lot with an accepted courier quote shows it as a charge in this
 * payment; every other lot says the choice comes after paying, because collection, a courier and
 * one's own shipper are chosen on the purchase page once the work is paid for.
 */
function deliveryVm(plan: PayPlan): PayDeliveryVm {
  const several = plan.payable.length > 1;
  const rows = plan.payable.map((p): PayDeliveryRowVm => {
    const charge = plan.delivery.find((d) => d.lotId === p.lotId);
    if (!charge) {
      return {
        lotId: p.lotId,
        title: p.title,
        detail: several ? null : PAY_COPY.deliveryNote,
        badge: { label: PAY_COPY.deliveryTitle, tone: "neutral", shape: "ring" },
      };
    }
    return {
      lotId: p.lotId,
      title: p.title,
      detail: [PAY_COPY.deliveryCourierTo(charge.destination), charge.note]
        .filter((part): part is string => Boolean(part))
        .join(" · "),
      badge: {
        label: PAY_COPY.deliveryCourier(formatGbp(charge.amountPence)),
        tone: "info",
        shape: "dot",
      },
    };
  });
  const quoteStillOpen = plan.deliveryInPayment && plan.delivery.length < plan.payable.length;
  const [only] = plan.payable;
  const note =
    plan.delivery.length > 0
      ? PAY_COPY.deliveryChargedNote
      : several
        ? PAY_COPY.deliverySeveralNote
        : "";
  return {
    rows,
    note,
    quoteLink: quoteStillOpen
      ? {
          before: PAY_COPY.deliveryQuoteHint,
          label: PAY_COPY.deliveryQuoteLink,
          after: PAY_COPY.deliveryQuoteAdded,
          href:
            !several && only ? `${CLIENT_ROUTES.purchases}/${only.lotId}` : CLIENT_ROUTES.purchases,
        }
      : null,
  };
}

/** The company that issues the invoices, and its numbers once they exist. */
export function entityLines(
  entity: PayPlan["entity"],
): Pick<PayMoneyVm, "company" | "registration"> {
  return {
    company: PAY_COPY.invoiceFrom(entity.name, entity.address),
    registration: [
      entity.companyNumber ? `Company number ${entity.companyNumber}` : null,
      entity.vatNumber ? `VAT number ${entity.vatNumber}` : null,
    ].filter((part): part is string => part !== null),
  };
}

function moneyVm(plan: PayPlan, now: Date, totalLabel: string): PayMoneyVm | null {
  if (plan.payable.length === 0 || plan.firstDueAt === null) return null;
  const overdue = plan.payable.some((p) => p.overdue);
  const due = dayLabel(plan.firstDueAt, now);
  return {
    lines: moneyLines(plan),
    totalLabel,
    total: formatGbp(plan.totals.pence),
    due: overdue ? PAY_COPY.wasDue(due) : PAY_COPY.dueBy(due),
    ...entityLines(plan.entity),
    meter: null,
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
    delivery: null,
    methods: null,
    action: null,
    railPay: null,
    progress: null,
    returned: null,
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

/** What the action says for each way to pay, in the words of the approved design. */
function methodActions(
  total: string,
  organisation: string | null,
  returned: PayVmContext["returned"],
): Record<PayMethod, PayMethodAction> {
  const again = { label: PAY_COPY.tryAgainTotal(total), barLabel: PAY_COPY.tryAgain };
  const card =
    returned === "cancelled"
      ? again
      : {
          label: organisation
            ? PAY_COPY.payForOrganisation(total, organisation)
            : PAY_COPY.payLabel(total),
          barLabel: PAY_COPY.payBar,
        };
  return {
    card: { ...card, note: PAY_COPY.underButton, retry: again },
    bank_transfer: {
      label: PAY_COPY.continueToBankTransfer,
      barLabel: PAY_COPY.continueBar,
      note: PAY_COPY.bankUnderButton,
    },
  };
}

function payActionFor(
  plan: PayPlan,
  returned: PayVmContext["returned"],
): { action: PayAction | null; methods: PayMethodsVm | null; notice: PayNotice | null } {
  const methods = payMethodsVm(plan);
  if (!methods) {
    // The total is more than one online payment takes: say so, offer no way to pay it.
    return {
      action: null,
      methods: null,
      notice: { tone: "warning", title: PAY_COPY.overOnlineLimit },
    };
  }
  const organisation = plan.account.kind === "organisation" ? plan.account.name : null;
  return {
    action: {
      kind: "pay",
      byMethod: methodActions(formatGbp(plan.totals.pence), organisation, returned),
      lotIds: plan.payable.map((p) => p.lotId),
      expectedTotalPence: plan.totals.pence,
    },
    methods,
    notice: null,
  };
}

/**
 * The note for a payment the payment page sent the person back from, shown once. It is announced
 * and takes focus, so someone who left a bank's check unfinished finds out what happened.
 */
function returnedNote(
  returned: PayVmContext["returned"],
  cleanHref: string,
): PayPageVm["returned"] {
  return returned === "cancelled"
    ? { title: PAY_COPY.notCompletedTitle, detail: PAY_COPY.notCompletedBody, cleanHref }
    : null;
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
  return {
    ...buildPayBody(plan, now, context),
    returned: returnedNote(context.returned, context.returnTo),
  };
}

function buildPayBody(
  plan: PayPlan,
  now: Date,
  context: PayVmContext,
): Omit<PayPageVm, "returned"> {
  const { returnTo, details } = context;
  if (plan.payable.length === 0) return nothingPayable(plan, returnTo);

  const several = plan.payable.length > 1;
  const { title, subtitle } = heading(plan, now, details);
  const [only] = plan.payable;
  const leftOut = leftOutNotice(plan.leftOut);
  const common = {
    title,
    subtitle,
    lots: plan.payable.map((p) => lotVm(p, now, several, details)),
    delivery: deliveryVm(plan),
    empty: null,
    methods: null as PayMethodsVm | null,
    progress: null,
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
      notices: [outcome.notice, ...(leftOut ? [leftOut] : [])],
      money: moneyVm(plan, now, PAY_COPY.totalToPay),
      railPay: identity
        ? { label: PAY_COPY.payLabel(formatGbp(plan.totals.pence)), reason: PAY_COPY.verifyToPay }
        : null,
      action: outcome.notice.action
        ? { kind: "link", label: outcome.notice.action.label, href: outcome.notice.action.href }
        : null,
    };
  }

  const pay = payActionFor(plan, context.returned);
  return {
    ...common,
    state: "ready",
    badge: readyBadge(plan, now),
    notices: [
      ...overdueNotice(plan, now, context.contactHref),
      ...(pay.notice ? [pay.notice] : []),
      ...(leftOut ? [leftOut] : []),
    ],
    money: moneyVm(plan, now, PAY_COPY.totalToPay),
    methods: pay.methods,
    action: pay.action,
  };
}
