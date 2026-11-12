import { dashboardSofRequirementsUrl } from "@/lib/dashboard/dashboard-copy";
import type { AccountPurchaseFacts } from "@/lib/data/http/account-buying.types";
import type { LotFulfilmentSnapshot } from "@/lib/data/http/payments.schema";
import { formatMoney, lotChargeCurrency } from "@/lib/format-currency";
import { CLIENT_ROUTES, organisationHref } from "@/lib/navigation/client-routes";
import { payHref } from "@/lib/pay/pay-links";
import { lotPath } from "@/lib/seo/url";
import { formatDate, formatDayMonthOnly } from "@auction/datetime";
import { LONDON_TIME_ZONE, formatWhen } from "@auction/datetime";
import {
  type AmountOwedBlocker,
  type AmountOwedEntry,
  type AmountsOwedSummary,
  PURCHASE_LIST_LIMIT,
  type PurchasePaymentRole,
  addMoneyStrings,
  invoiceDueAt,
  summariseAmountsOwed,
} from "@auction/domain";
import type { PortfolioRow } from "@auction/types";
import { formatGbp } from "@auction/ui";
import { PURCHASE_STATE_LABEL } from "./purchase-labels";
import { purchaseProblemHref } from "./purchase-problem";
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
  /**
   * The deadline the note quotes, when it is a payment deadline: the page adds the visitor's own
   * time under it. A deadline stays on London's day (it is London's 23:59).
   */
  dueMoment: { iso: string; zone: string } | null;
  amountLabel: string;
  amount: string;
  /** Someone else pays this purchase (an organisation's); the member is told, never asked. */
  informed: boolean;
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

/**
 * The summary above the list while something is owed, with what one payment would cover. When
 * documents are what holds the account, the one place that asks for them is here: rows only say
 * where each purchase stands.
 */
export type PayNowVm =
  | {
      kind: "pay";
      title: string;
      description: string;
      /** The invoices one payment would pick, and their total. */
      lotIds: string[];
      total: string;
      documentsAction: PayNowDocumentsAction | null;
    }
  | {
      kind: "review";
      title: string;
      description: string;
      documentsAction: PayNowDocumentsAction | null;
    };

export type PayNowDocumentsAction = { label: string; href: string };

export type PurchasesVm = {
  cardsByTab: Record<PurchaseTab, PurchaseCardVm[]>;
  payNow: PayNowVm | null;
  /** Every won lot. */
  total: number;
  /** The list holds the most purchases one read follows, so older ones are not shown. */
  truncated: boolean;
  /** The sales and winners in the list, A to Z, for the filters. */
  sales: { id: string; title: string }[];
  winners: string[];
};

export type PurchaseSources = {
  rows: readonly PortfolioRow[];
  /** Invoice links, by lot. */
  invoiceByLot: Readonly<Record<string, string>>;
  fulfilmentByLot: Readonly<Record<string, LotFulfilmentSnapshot>>;
  /**
   * What the account owes, by lot: the amounts-owed reading the header chip and the menu share.
   * A lot missing here owes nothing (it is being paid, paid or refunded).
   */
  owedByLot: Readonly<Record<string, AmountOwedEntry>>;
  saleTitleById: Readonly<Record<string, string>>;
  /**
   * How the person stands to each purchase, by lot. Missing means they pay it. A buyer agent is
   * `informed` of the organisation's purchases they won: told how payment goes, never asked to pay.
   */
  paymentRoleByLot: Readonly<Record<string, PurchasePaymentRole>>;
  /** The organisation that pays what the person does not, or `null` when it is not known. */
  payerName: string | null;
  /**
   * The organisation the person is acting for, when they are: so a hold can say whose it is, and
   * whether the person can open the organisation's setup (owners and admins).
   */
  organisation?: { id: string; name: string; canManage: boolean } | null;
  /** The moment dates are read against; the present when left out. */
  now?: Date;
  /** The account's invoice and delivery state per lot, when it could be read. */
  factsByLot?: Readonly<Record<string, AccountPurchaseFacts>>;
  /** Several members win for the account, so rows name who won. */
  showWonBy?: boolean;
};

/** "12 November": a day and month in full, in London time. */
function longDayMonth(date: Date): string {
  return formatDate(date, LONDON_TIME_ZONE, { month: "long" }).replace(/ \d{4}$/, "");
}

function dueDate(row: PortfolioRow, facts: AccountPurchaseFacts | null = null): Date {
  if (facts?.invoice.dueAt) return facts.invoice.dueAt;
  const from = row.payment?.createdAt ? new Date(row.payment.createdAt) : row.lot.endTime;
  return invoiceDueAt(new Date(from));
}

/** The Pay page's words for a rejected or archived organisation. */
const REFUSED_ORGANISATION = "This organisation can't make payments. Contact client services.";

/**
 * What the member still has to send on a part-funded bank transfer for this purchase, in whole
 * pence. Only the member who pays is asked; the one who merely won is told how payment goes. The
 * figure is the API's share of the transfer's whole remainder, so it is the same on every page
 * and the same one the LAX Account portfolio and the header chip state.
 */
function stillToSendOf(
  state: PurchaseState,
  informed: boolean,
  facts: AccountPurchaseFacts | null,
): number | null {
  if (informed || state !== "payment-processing") return null;
  return facts?.invoice.stillToSendPence || null;
}

function noteFor(
  state: PurchaseState,
  row: PortfolioRow,
  blocker: AmountOwedBlocker | null,
  fulfilment: LotFulfilmentSnapshot | undefined,
  facts: AccountPurchaseFacts | null = null,
  stillToSend: number | null = null,
  refused = false,
  now: Date = new Date(),
): string | null {
  switch (state) {
    case "payment-due":
      return `Pay by ${formatWhen(dueDate(row, facts), LONDON_TIME_ZONE, now)}`;
    case "in-review":
      if (refused) return REFUSED_ORGANISATION;
      return blocker === "documents"
        ? "We need to confirm the source of funds before you pay"
        : "We're checking a few details before you can pay";
    case "payment-processing":
      return stillToSend === null
        ? "Your payment is being confirmed"
        : `${formatGbp(stillToSend)} still to send on your bank transfer`;
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
        ? `Collected ${longDayMonth(new Date(fulfilment.collectedAt))}`
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

/** A row shows status only; the one action for an account's checks lives in the banner. */
function primaryActionFor(
  state: PurchaseState,
  row: PortfolioRow,
  stillToSend: number | null,
): PurchaseCardVm["primaryAction"] {
  // The rest of a transfer is sent with the details already given, which the Pay page shows.
  if (stillToSend !== null) {
    return { label: "See transfer details", href: payHref([row.lot.id]) };
  }
  if (state === "choose-delivery") {
    return { label: "Arrange delivery", href: `${CLIENT_ROUTES.purchases}/${row.lot.id}` };
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
  if (step === "won") return formatDayMonthOnly(row.lot.endTime, LONDON_TIME_ZONE);
  if (step === "payment" && (state === "payment-due" || state === "in-review")) {
    return `Due ${formatDayMonthOnly(dueDate(row, facts), LONDON_TIME_ZONE)}`;
  }
  if (step === "delivered" && fulfilment?.collectedAt) {
    return formatDayMonthOnly(new Date(fulfilment.collectedAt), LONDON_TIME_ZONE);
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

function amountLabel(state: PurchaseState, stillToSend: number | null): string {
  if (state === "payment-due" || state === "in-review" || stillToSend !== null) return "total due";
  if (state === "refunded") return "refunded";
  if (state === "cancelled") return "was due";
  return "total paid";
}

/**
 * Delivery records are only read for paid lots; the amounts-owed reading also knows when the
 * sale was cancelled at fulfilment, so an unpaid purchase that was cancelled ends like any other.
 */
function cancelledDelivery(owed: AmountOwedEntry | null): PurchaseFacts["fulfilment"] {
  return owed?.state === "cancelled"
    ? { status: "cancelled", fulfilmentMethod: null, collectedAt: null }
    : null;
}

/** One purchase as its row and its page read it. */
export function purchaseCard(row: PortfolioRow, sources: PurchaseSources): PurchaseCardVm {
  const { lot } = row;
  const owed = sources.owedByLot[lot.id] ?? null;
  const blocker = owed?.blocker ?? null;
  const fulfilment = sources.fulfilmentByLot[lot.id];
  const facts = sources.factsByLot?.[lot.id] ?? null;
  const state = purchaseState({
    paymentStatus: row.payment?.status ?? null,
    inReview: owed?.state === "in-review",
    fulfilment: fulfilment ?? cancelledDelivery(owed),
  });
  const currency = lotChargeCurrency(lot);
  const informed = (sources.paymentRoleByLot[lot.id] ?? "payer") !== "payer";
  const stillToSend = stillToSendOf(state, informed, facts);
  const paidBy =
    informed && PAID_STATES.has(state)
      ? `${capitalise(possessive(payer(sources.payerName)))} finance team`
      : null;
  // What is owed is the reading's total; otherwise the lot's priced total (paid, refunded).
  const totalMajor =
    owed && owed.state !== "cancelled" && owed.amountDue
      ? owed.amountDue
      : (lot.checkoutPricing?.totalMajor ?? null);
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
        : stillToSend !== null
          ? "Still to send"
          : PURCHASE_STATE_LABEL[state],
    statusNote: informed
      ? (informedNoteFor(state, sources.payerName) ??
        noteFor(state, row, blocker, fulfilment, facts ?? null))
      : noteFor(
          state,
          row,
          blocker,
          fulfilment,
          facts ?? null,
          stillToSend,
          owed?.refused === true,
          sources.now,
        ),
    dueMoment:
      !informed && state === "payment-due"
        ? { iso: dueDate(row, facts).toISOString(), zone: LONDON_TIME_ZONE }
        : null,
    amountLabel: amountLabel(state, stillToSend),
    amount: totalMajor ? formatMoney(totalMajor, currency) : "—",
    informed,
    payable,
    dueAt: dueDate(row, facts).getTime(),
    wonAt: lot.endTime.getTime(),
    steps: stepsFor(state, row, fulfilment, facts),
    breakdown: breakdownFor(row, paidBy),
    // Paying and arranging delivery belong to whoever pays; the member who won is only told.
    primaryAction: informed ? null : primaryActionFor(state, row, stillToSend),
    invoiceHref: sources.invoiceByLot[lot.id] ?? null,
    problemHref: canReportProblem(state) ? purchaseProblemHref(lot.id) : null,
  };
}

function plural(count: number, one: string, many: string): string {
  return `${count === 1 ? "One" : count} ${count === 1 ? one : many}`;
}

/** The one place a purchase asks for documents. */
function documentsActionFor(blocker: AmountOwedBlocker | null): PayNowDocumentsAction | null {
  return blocker === "documents"
    ? { label: "Provide documents", href: dashboardSofRequirementsUrl() }
    : null;
}

/**
 * The summary while checks hold everything that is owed, saying whose check it is. A person's own
 * account is in review; for an organisation it is the organisation's (and its owners and admins
 * can open its setup), the payer's own checks, or the winner's, which only we can finish.
 */
function reviewNow(
  owed: Pick<AmountsOwedSummary, "holder" | "blocker" | "refused">,
  sources: PurchaseSources,
): PayNowVm {
  const { holder, blocker } = owed;
  const organisation = sources.organisation ?? null;
  if (!organisation) {
    const documentsAction = documentsActionFor(blocker);
    return {
      kind: "review",
      title: "Your account is in review",
      description: documentsAction
        ? "We need some documents before you can pay."
        : "You can pay once our checks are done.",
      documentsAction,
    };
  }
  if (owed.refused) {
    // Closed for good, not a check that will clear: the same words as the Pay page.
    return {
      kind: "review",
      title: `${organisation.name} can't make payments`,
      description: "Contact client services and we'll help.",
      documentsAction: null,
    };
  }
  if (holder === "organisation") {
    return {
      kind: "review",
      title: `${organisation.name} is in review`,
      description: "We're checking this organisation's details. You can pay once we have.",
      documentsAction: organisation.canManage
        ? { label: "Open organisation setup", href: organisationHref("profile", organisation.id) }
        : null,
    };
  }
  if (holder === "winner") {
    return {
      kind: "review",
      // Never say whose check it is: the rows name who won, and naming a colleague under a
      // compliance check would tip them off. Same neutral words as the Pay page.
      title: "We're checking a few details before this can be paid",
      description: "You can pay once we have.",
      documentsAction: null,
    };
  }
  const documentsAction = documentsActionFor(blocker);
  return {
    kind: "review",
    title: "Your own checks are in review",
    description: documentsAction
      ? "We need some of your documents before you can pay for this organisation."
      : "You can pay once our checks on you are done.",
    documentsAction,
  };
}

/** What is due, in one line, and the payment that settles it. */
function payNowFor(cards: readonly PurchaseCardVm[], sources: PurchaseSources): PayNowVm | null {
  const owed = summariseAmountsOwed(Object.values(sources.owedByLot));
  if (owed.count === 0) return null;
  const payable = cards.filter((card) => card.payable);
  if (payable.length === 0) {
    // Nothing can be paid yet: say so only when our checks are what holds it.
    if (!owed.inReview) return null;
    return reviewNow(owed, sources);
  }
  const documentsAction = documentsActionFor(owed.blocker);
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
    documentsAction,
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
  const sales = new Map<string, string>();
  for (const card of cards)
    if (card.saleId && card.saleTitle) sales.set(card.saleId, card.saleTitle);
  return {
    cardsByTab,
    payNow: payNowFor(cards, sources),
    total: cards.length,
    truncated: cards.length >= PURCHASE_LIST_LIMIT,
    sales: [...sales]
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title)),
    winners: [...new Set(cards.flatMap((card) => (card.wonBy ? [card.wonBy] : [])))].sort((a, b) =>
      a.localeCompare(b),
    ),
  };
}
