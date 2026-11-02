import {
  dashboardCheckoutLotUrl,
  dashboardSofRequirementsUrl,
} from "@/lib/dashboard/dashboard-copy";
import type { AccountPurchaseFacts } from "@/lib/data/http/account-buying.types";
import type { ComplianceGateStatus, LotFulfilmentSnapshot } from "@/lib/data/http/payments.schema";
import { buildPayNow } from "@/lib/data/view-models/dashboard-portfolio.vm";
import { formatMoney, lotChargeCurrency } from "@/lib/format-currency";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { portfolioComplianceReason } from "@/lib/portfolio-settlement";
import { lotPath } from "@/lib/seo/url";
import { type PurchasePaymentRole, addMoneyStrings } from "@auction/domain";
import {
  INVOICE_PAYMENT_DUE_DAYS,
  type ManualReviewReason,
  type PortfolioRow,
} from "@auction/types";
import { PURCHASE_STATE_LABEL } from "./purchase-labels";
import {
  PURCHASE_STEPS,
  PURCHASE_TABS,
  type PurchaseFacts,
  type PurchaseState,
  type PurchaseStep,
  type PurchaseTab,
  canReportProblem,
  purchaseEndedEarly,
  purchaseState,
  purchaseStep,
  purchaseTab,
} from "./purchase-progress";
import { type PurchaseBadge, purchaseBadge } from "./purchase-standing";

export { PURCHASE_STATE_LABEL };

export const REPORT_PROBLEM_HREF = "/contact?intent=purchase-problem";

const STEP_LABEL: Record<PurchaseStep, string> = {
  won: "Won",
  payment: "Payment",
  delivery: "Delivery",
  delivered: "Delivered",
};

export type PurchaseStepVm = {
  id: PurchaseStep;
  label: string;
  /** A short date under the step ("24 Oct", "Due 7 Nov"), when one is known. */
  date: string | null;
  progress: "done" | "current" | "upcoming";
};

export type PurchaseCardVm = {
  lotId: string;
  /** The purchase's own page: progress, payment, delivery and documents. */
  detailHref: string;
  /** The lot page. */
  lotHref: string;
  image: string | null;
  title: string;
  lotLabel: string | null;
  saleId: string | null;
  saleTitle: string | null;
  /** Who won it, on an organisation's shared list; `null` where it goes without saying. */
  wonBy: string | null;
  tab: PurchaseTab;
  state: PurchaseState;
  badge: PurchaseBadge;
  statusLabel: string;
  statusNote: string | null;
  amountLabel: string;
  amount: string;
  /** Set when this member can pick the invoice to pay now: its amount, as a decimal string. */
  payable: { totalDue: string; currency: string } | null;
  /** For sorting: the due date (or the win), and when it was won. */
  dueAt: number;
  wonAt: number;
  /** `null` when the purchase ended early (refunded or cancelled). */
  steps: PurchaseStepVm[] | null;
  breakdown: { label: string; value: string }[];
  primaryAction: { label: string; href: string } | null;
  invoiceHref: string | null;
  problemHref: string | null;
};

/** The summary above the list while something is due, with what one payment would cover. */
export type PayNowVm =
  | {
      kind: "pay";
      title: string;
      description: string;
      /** The invoices one payment would pick, and their total. */
      lotIds: string[];
      total: string;
    }
  | { kind: "review"; title: string; description: string };

export type PurchasesVm = {
  cardsByTab: Record<PurchaseTab, PurchaseCardVm[]>;
  payNow: PayNowVm | null;
  /** Every won lot. */
  total: number;
  /** The sales and winners in the list, A to Z, for the filters. */
  sales: { id: string; title: string }[];
  winners: string[];
};

export type PurchaseSources = {
  rows: readonly PortfolioRow[];
  /** Invoice links, by lot. */
  invoiceByLot: Readonly<Record<string, string>>;
  fulfilmentByLot: Readonly<Record<string, LotFulfilmentSnapshot>>;
  complianceGate: ComplianceGateStatus;
  saleTitleById: Readonly<Record<string, string>>;
  /**
   * How the person stands to each purchase, by lot. Missing means they pay it. A buyer agent is
   * `informed` of the organisation's purchases they won: told how payment goes, never asked to pay.
   */
  paymentRoleByLot: Readonly<Record<string, PurchasePaymentRole>>;
  /** The organisation that pays what the person does not, or `null` when it is not known. */
  payerName: string | null;
  /** The account's invoice and delivery state per lot, when it could be read. */
  factsByLot?: Readonly<Record<string, AccountPurchaseFacts>>;
  /** Several members win for the account, so rows name who won. */
  showWonBy?: boolean;
};

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const DAY_MONTH_LONG = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" });

function dueDate(row: PortfolioRow, facts: AccountPurchaseFacts | null = null): Date {
  if (facts?.invoice.dueAt) return facts.invoice.dueAt;
  const from = row.payment?.createdAt ? new Date(row.payment.createdAt) : row.lot.endTime;
  const due = new Date(from);
  due.setUTCDate(due.getUTCDate() + INVOICE_PAYMENT_DUE_DAYS);
  return due;
}

/** The review reason for a lot still to pay: its own, else the account-wide hold. */
function reviewReason(row: PortfolioRow, gate: ComplianceGateStatus): ManualReviewReason | null {
  const own = portfolioComplianceReason(row);
  if (own) return own;
  const unpaid = row.payment?.status !== "captured" && row.payment?.status !== "refunded";
  return unpaid && gate !== "clear" ? gate : null;
}

function noteFor(
  state: PurchaseState,
  row: PortfolioRow,
  reason: ManualReviewReason | null,
  fulfilment: LotFulfilmentSnapshot | undefined,
): string | null {
  switch (state) {
    case "payment-due":
      return `Pay by ${DAY_MONTH_LONG.format(dueDate(row))}`;
    case "in-review":
      return reason === "source_of_funds_required"
        ? "We need to confirm the source of funds before you pay"
        : "We're checking a few details before you can pay";
    case "payment-processing":
      return "Your payment is being confirmed";
    case "choose-delivery":
      return "Collect in London or send by insured courier";
    case "preparing":
      return fulfilment?.fulfilmentMethod === "collection"
        ? "Being prepared for collection"
        : "Being prepared for insured courier";
    case "ready-for-collection":
      return "Ready to collect in London";
    case "in-transit":
      return fulfilment?.trackingNumber
        ? `Insured courier · tracking ${fulfilment.trackingNumber}`
        : "With our insured courier";
    case "delivered":
      return "Delivered by insured courier";
    case "collected":
      return fulfilment?.collectedAt
        ? `Collected ${DAY_MONTH_LONG.format(new Date(fulfilment.collectedAt))}`
        : "Collected from LAX";
    case "refunded":
      return "Your payment has been refunded";
    case "cancelled":
      return "This purchase was cancelled";
  }
}

/** "Northbank Gallery" or, when the paying organisation is not known, "your organisation". */
function payer(name: string | null): string {
  return name ?? "your organisation";
}

/** How a purchase someone else pays reads to the member who won it. */
function informedNoteFor(state: PurchaseState, name: string | null): string | null {
  const team = `${capitalise(possessive(payer(name)))} finance team`;
  switch (state) {
    case "payment-due":
    case "in-review":
      return `Waiting for payment by ${payer(name)}`;
    case "payment-processing":
      return `${capitalise(possessive(payer(name)))} payment is being confirmed`;
    case "choose-delivery":
      return `${team} is arranging delivery`;
    case "refunded":
      return "The payment has been refunded";
    default:
      return null;
  }
}

function possessive(name: string): string {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function primaryActionFor(
  state: PurchaseState,
  row: PortfolioRow,
  reason: ManualReviewReason | null,
): PurchaseCardVm["primaryAction"] {
  if (state === "choose-delivery") {
    return { label: "Arrange delivery", href: dashboardCheckoutLotUrl(row.lot.id) };
  }
  if (state === "in-review" && reason === "source_of_funds_required") {
    return { label: "Provide documents", href: dashboardSofRequirementsUrl() };
  }
  return null;
}

function stepDate(
  step: PurchaseStep,
  state: PurchaseState,
  row: PortfolioRow,
  fulfilment: LotFulfilmentSnapshot | undefined,
  facts: AccountPurchaseFacts | null,
): string | null {
  if (step === "won") return DAY_MONTH.format(row.lot.endTime);
  if (step === "payment" && (state === "payment-due" || state === "in-review")) {
    return `Due ${DAY_MONTH.format(dueDate(row, facts))}`;
  }
  if (step === "delivered" && fulfilment?.collectedAt) {
    return DAY_MONTH.format(new Date(fulfilment.collectedAt));
  }
  return null;
}

function stepsFor(
  state: PurchaseState,
  row: PortfolioRow,
  fulfilment: LotFulfilmentSnapshot | undefined,
  facts: AccountPurchaseFacts | null,
): PurchaseStepVm[] | null {
  if (purchaseEndedEarly(state)) return null;
  const at = PURCHASE_STEPS.indexOf(purchaseStep(state));
  // A delivered purchase has completed every step, including the last.
  const finished = state === "delivered" || state === "collected";
  return PURCHASE_STEPS.map((id, index) => ({
    id,
    label: STEP_LABEL[id],
    date: stepDate(id, state, row, fulfilment, facts),
    progress: index < at || finished ? "done" : index === at ? "current" : "upcoming",
  }));
}

function breakdownFor(row: PortfolioRow, paidBy: string | null): PurchaseCardVm["breakdown"] {
  const pricing = row.lot.checkoutPricing;
  const lines: PurchaseCardVm["breakdown"] = [];
  if (pricing) {
    const currency = lotChargeCurrency(row.lot);
    lines.push(
      { label: "Hammer price", value: formatMoney(pricing.hammerMajor, currency) },
      { label: "Buyer's premium", value: formatMoney(pricing.premiumMajor, currency) },
    );
  }
  if (paidBy) lines.push({ label: "Paid by", value: paidBy });
  return lines;
}

/** Paid states: the purchase has been paid for, so who paid it can be said. */
const PAID_STATES: ReadonlySet<PurchaseState> = new Set([
  "choose-delivery",
  "preparing",
  "ready-for-collection",
  "in-transit",
  "delivered",
  "collected",
]);

function amountLabel(state: PurchaseState): string {
  if (state === "payment-due" || state === "in-review") return "total due";
  if (state === "refunded") return "refunded";
  if (state === "cancelled") return "was due";
  return "total paid";
}

/**
 * Delivery records are only read for paid lots; for the rest the account's facts say whether the
 * purchase was cancelled, so an unpaid purchase that was cancelled ends like any other.
 */
function cancelledDelivery(facts: AccountPurchaseFacts | null): PurchaseFacts["fulfilment"] {
  return facts?.delivery.stage === "cancelled"
    ? { status: "cancelled", fulfilmentMethod: null, collectedAt: null }
    : null;
}

/** One purchase as its row and its page read it. */
export function purchaseCard(row: PortfolioRow, sources: PurchaseSources): PurchaseCardVm {
  const { lot } = row;
  const reason = reviewReason(row, sources.complianceGate);
  const fulfilment = sources.fulfilmentByLot[lot.id];
  const facts = sources.factsByLot?.[lot.id] ?? null;
  const state = purchaseState({
    paymentStatus: row.payment?.status ?? null,
    reviewReason: reason,
    fulfilment: fulfilment ?? cancelledDelivery(facts),
  });
  const currency = lotChargeCurrency(lot);
  const informed = (sources.paymentRoleByLot[lot.id] ?? "payer") !== "payer";
  const paidBy =
    informed && PAID_STATES.has(state)
      ? `${capitalise(possessive(payer(sources.payerName)))} finance team`
      : null;
  const totalMajor = lot.checkoutPricing?.totalMajor ?? null;
  // Only a raised invoice can be paid; the account's facts say so when they are to hand.
  const invoiced = facts
    ? facts.invoice.status === "due" || facts.invoice.status === "overdue"
    : true;
  const payable =
    !informed && state === "payment-due" && invoiced && totalMajor
      ? { totalDue: totalMajor, currency }
      : null;
  return {
    tab: purchaseTab(state),
    lotId: lot.id,
    detailHref: `${CLIENT_ROUTES.purchases}/${encodeURIComponent(lot.id)}`,
    lotHref: lotPath(lot),
    image: lot.images[0] ?? null,
    title: lot.title,
    lotLabel: lot.lotNumber == null ? null : `Lot ${lot.lotNumber}`,
    saleId: lot.saleId ?? null,
    saleTitle: lot.saleId ? (sources.saleTitleById[lot.saleId] ?? null) : null,
    wonBy: sources.showWonBy ? (facts?.wonBy?.name ?? null) : null,
    state,
    badge: purchaseBadge(state, facts, informed),
    statusLabel:
      informed && (state === "payment-due" || state === "in-review")
        ? "Awaiting payment"
        : PURCHASE_STATE_LABEL[state],
    statusNote: informed
      ? (informedNoteFor(state, sources.payerName) ?? noteFor(state, row, reason, fulfilment))
      : noteFor(state, row, reason, fulfilment),
    amountLabel: amountLabel(state),
    amount: totalMajor ? formatMoney(totalMajor, currency) : "—",
    payable,
    dueAt: dueDate(row, facts).getTime(),
    wonAt: lot.endTime.getTime(),
    steps: stepsFor(state, row, fulfilment, facts),
    breakdown: breakdownFor(row, paidBy),
    // Paying and arranging delivery belong to whoever pays; the member who won is only told.
    primaryAction: informed ? null : primaryActionFor(state, row, reason),
    invoiceHref: sources.invoiceByLot[lot.id] ?? null,
    problemHref: canReportProblem(state) ? REPORT_PROBLEM_HREF : null,
  };
}

function plural(count: number, one: string, many: string): string {
  return `${count === 1 ? "One" : count} ${count === 1 ? one : many}`;
}

/** What is due, in one line, and the payment that settles it. */
function payNowFor(
  cards: readonly PurchaseCardVm[],
  rows: readonly PortfolioRow[],
  sources: PurchaseSources,
): PayNowVm | null {
  const mine = rows.filter((row) => (sources.paymentRoleByLot[row.lot.id] ?? "payer") === "payer");
  const due = buildPayNow(mine, sources.complianceGate);
  if (!due) return null;
  const payable = cards.filter((card) => card.payable);
  if (payable.length === 0) {
    // Nothing can be paid yet: say so only when our checks are what holds it.
    if (!cards.some((card) => card.state === "in-review" && card.statusLabel === "In review")) {
      return null;
    }
    return {
      kind: "review",
      title: "We're reviewing your account",
      description: "You can pay once our checks are done. Each purchase says what is needed.",
    };
  }
  const [first] = payable;
  const currency = first?.payable?.currency ?? "GBP";
  const total = payable.reduce(
    (sum, card) => addMoneyStrings(sum, card.payable?.totalDue ?? "0"),
    "0.00",
  );
  const overdue = payable.filter((card) => card.badge.tone === "danger").length;
  const invoices = payable.length === 1 ? "1 invoice" : `${payable.length} invoices`;
  const lead = overdue > 0 ? `${plural(overdue, "is", "are")} overdue. ` : "";
  return {
    kind: "pay",
    title: `${invoices} · ${formatMoney(total, currency)} due`,
    description:
      payable.length === 1
        ? `${lead}Pay by card or bank transfer.`
        : `${lead}Pay them together by card or bank transfer.`,
    lotIds: payable.map((card) => card.lotId),
    total,
  };
}

/** Every view of Purchases at once, so the page can search, filter and switch without a trip. */
export function buildPurchasesVm(sources: PurchaseSources): PurchasesVm {
  const cards = [...sources.rows]
    .sort((a, b) => b.lot.endTime.getTime() - a.lot.endTime.getTime())
    .map((row) => purchaseCard(row, sources));
  const cardsByTab = Object.fromEntries(
    PURCHASE_TABS.map((tab) => [tab, cards.filter((card) => card.tab === tab)]),
  ) as Record<PurchaseTab, PurchaseCardVm[]>;
  // The Pay now banner follows the To pay view, so a cancelled purchase can never be in it.
  const toPayLots = new Set((cardsByTab["to-pay"] ?? []).map((card) => card.lotId));
  const sales = new Map<string, string>();
  for (const card of cards)
    if (card.saleId && card.saleTitle) sales.set(card.saleId, card.saleTitle);
  return {
    cardsByTab,
    payNow: payNowFor(
      cards,
      sources.rows.filter((row) => toPayLots.has(row.lot.id)),
      sources,
    ),
    total: cards.length,
    sales: [...sales]
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title)),
    winners: [...new Set(cards.flatMap((card) => (card.wonBy ? [card.wonBy] : [])))].sort((a, b) =>
      a.localeCompare(b),
    ),
  };
}
