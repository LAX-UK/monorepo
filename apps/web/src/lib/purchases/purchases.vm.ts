import {
  dashboardCheckoutLotUrl,
  dashboardSofRequirementsUrl,
} from "@/lib/dashboard/dashboard-copy";
import type { ComplianceGateStatus, LotFulfilmentSnapshot } from "@/lib/data/http/payments.schema";
import { buildPayNow } from "@/lib/data/view-models/dashboard-portfolio.vm";
import { formatMoney, resolveLotCurrency } from "@/lib/format-currency";
import { portfolioComplianceReason } from "@/lib/portfolio-settlement";
import { lotPath } from "@/lib/seo/url";
import {
  INVOICE_PAYMENT_DUE_DAYS,
  type ManualReviewReason,
  type PortfolioRow,
} from "@auction/types";
import {
  PURCHASE_STEPS,
  PURCHASE_TABS,
  PURCHASE_TAB_LABEL,
  type PurchaseState,
  type PurchaseStep,
  type PurchaseTab,
  canReportProblem,
  defaultPurchaseTab,
  purchaseEndedEarly,
  purchaseState,
  purchaseStep,
  purchaseTab,
} from "./purchase-progress";

export const REPORT_PROBLEM_HREF = "/contact?intent=purchase-problem";

export const PURCHASE_STATE_LABEL: Record<PurchaseState, string> = {
  "payment-due": "Payment due",
  "in-review": "In review",
  "payment-processing": "Payment processing",
  "choose-delivery": "Choose delivery",
  preparing: "Preparing",
  "ready-for-collection": "Ready to collect",
  "in-transit": "On its way",
  delivered: "Delivered",
  collected: "Collected",
  refunded: "Refunded",
  cancelled: "Cancelled",
};

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
  href: string;
  image: string | null;
  title: string;
  lotLabel: string | null;
  saleTitle: string | null;
  state: PurchaseState;
  statusLabel: string;
  statusNote: string | null;
  amountLabel: string;
  amount: string;
  /** `null` when the purchase ended early (refunded or cancelled). */
  steps: PurchaseStepVm[] | null;
  breakdown: { label: string; value: string }[];
  primaryAction: { label: string; href: string } | null;
  invoiceHref: string | null;
  problemHref: string | null;
};

export type PayNowBannerVm = {
  title: string;
  description: string;
  /** Checkout for what can be paid now; `null` while every due lot is being reviewed. */
  href: string | null;
};

export type PurchasesVm = {
  tab: PurchaseTab;
  tabs: { id: PurchaseTab; label: string; count: number }[];
  cards: PurchaseCardVm[];
  payNow: PayNowBannerVm | null;
  total: number;
};

export type PurchaseSources = {
  rows: readonly PortfolioRow[];
  /** Invoice links, by lot. */
  invoiceByLot: Readonly<Record<string, string>>;
  fulfilmentByLot: Readonly<Record<string, LotFulfilmentSnapshot>>;
  complianceGate: ComplianceGateStatus;
  saleTitleById: Readonly<Record<string, string>>;
};

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const DAY_MONTH_LONG = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" });

function dueDate(row: PortfolioRow): Date {
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

function primaryActionFor(
  state: PurchaseState,
  row: PortfolioRow,
  reason: ManualReviewReason | null,
): PurchaseCardVm["primaryAction"] {
  // Paying is the "Pay now" banner's one job, so a due card does not repeat it.
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
): string | null {
  if (step === "won") return DAY_MONTH.format(row.lot.endTime);
  if (step === "payment" && (state === "payment-due" || state === "in-review")) {
    return `Due ${DAY_MONTH.format(dueDate(row))}`;
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
): PurchaseStepVm[] | null {
  if (purchaseEndedEarly(state)) return null;
  const at = PURCHASE_STEPS.indexOf(purchaseStep(state));
  // A delivered purchase has completed every step, including the last.
  const finished = state === "delivered" || state === "collected";
  return PURCHASE_STEPS.map((id, index) => ({
    id,
    label: STEP_LABEL[id],
    date: stepDate(id, state, row, fulfilment),
    progress: index < at || finished ? "done" : index === at ? "current" : "upcoming",
  }));
}

function breakdownFor(row: PortfolioRow): PurchaseCardVm["breakdown"] {
  const pricing = row.lot.checkoutPricing;
  if (!pricing) return [];
  const currency = resolveLotCurrency(row.lot);
  return [
    { label: "Hammer", value: formatMoney(pricing.hammerMajor, currency) },
    { label: "Buyer's premium", value: formatMoney(pricing.premiumMajor, currency) },
  ];
}

function amountLabel(state: PurchaseState): string {
  if (state === "payment-due" || state === "in-review") return "Total due";
  if (state === "refunded") return "Refunded";
  return "Total";
}

function toCard(
  row: PortfolioRow,
  sources: PurchaseSources,
): PurchaseCardVm & { tab: PurchaseTab } {
  const { lot } = row;
  const reason = reviewReason(row, sources.complianceGate);
  const fulfilment = sources.fulfilmentByLot[lot.id];
  const state = purchaseState({
    paymentStatus: row.payment?.status ?? null,
    reviewReason: reason,
    fulfilment: fulfilment ?? null,
  });
  const currency = resolveLotCurrency(lot);
  return {
    tab: purchaseTab(state),
    lotId: lot.id,
    href: lotPath(lot),
    image: lot.images[0] ?? null,
    title: lot.title,
    lotLabel: lot.lotNumber == null ? null : `Lot ${lot.lotNumber}`,
    saleTitle: lot.saleId ? (sources.saleTitleById[lot.saleId] ?? null) : null,
    state,
    statusLabel: PURCHASE_STATE_LABEL[state],
    statusNote: noteFor(state, row, reason, fulfilment),
    amountLabel: amountLabel(state),
    amount: lot.checkoutPricing ? formatMoney(lot.checkoutPricing.totalMajor, currency) : "—",
    steps: stepsFor(state, row, fulfilment),
    breakdown: breakdownFor(row),
    primaryAction: primaryActionFor(state, row, reason),
    invoiceHref: sources.invoiceByLot[lot.id] ?? null,
    problemHref: canReportProblem(state) ? REPORT_PROBLEM_HREF : null,
  };
}

/** The "Pay now" banner: what is due, by when, and one button to pay everything payable. */
function payNowBanner(
  rows: readonly PortfolioRow[],
  gate: ComplianceGateStatus,
): PayNowBannerVm | null {
  const payNow = buildPayNow(rows, gate);
  if (!payNow) return null;
  const due = rows.filter(
    (row) => row.payment?.status !== "captured" && row.payment?.status !== "refunded",
  );
  const earliest = due.map(dueDate).sort((a, b) => a.getTime() - b.getTime())[0];
  const by = earliest ? ` by ${DAY_MONTH_LONG.format(earliest)}` : "";
  const [only] = due;
  if (!payNow.href) {
    return {
      title: "We're reviewing your account",
      description: "You can pay once our checks are done. Each lot below says what is needed.",
      href: null,
    };
  }
  if (due.length === 1 && only) {
    const lotName = only.lot.lotNumber == null ? only.lot.title : `lot ${only.lot.lotNumber}`;
    return {
      title: `Pay for ${lotName}${by}`,
      description: `${only.lot.title} · ${payNow.outstandingLabel} including buyer's premium`,
      href: payNow.href,
    };
  }
  return {
    title: `Pay for ${due.length} lots${by}`,
    description: `${payNow.outstandingLabel} in total, including buyer's premium`,
    href: payNow.href,
  };
}

/** Purchases for one view, with the count in every view and the banner when something is due. */
export function buildPurchasesVm(
  sources: PurchaseSources,
  requestedTab: PurchaseTab | null,
): PurchasesVm {
  const cards = [...sources.rows]
    .sort((a, b) => b.lot.endTime.getTime() - a.lot.endTime.getTime())
    .map((row) => toCard(row, sources));
  const counts = Object.fromEntries(
    PURCHASE_TABS.map((tab) => [tab, cards.filter((card) => card.tab === tab).length]),
  ) as Record<PurchaseTab, number>;
  const tab = requestedTab ?? defaultPurchaseTab(counts);
  return {
    tab,
    tabs: PURCHASE_TABS.map((id) => ({ id, label: PURCHASE_TAB_LABEL[id], count: counts[id] })),
    cards: cards.filter((card) => card.tab === tab).map(({ tab: _tab, ...card }) => card),
    payNow: payNowBanner(sources.rows, sources.complianceGate),
    total: cards.length,
  };
}
