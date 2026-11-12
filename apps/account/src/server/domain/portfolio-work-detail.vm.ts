import { safeImageUrl } from "@/lib/media-origins";
import {
  type CurrencyTotal,
  type LaxPortfolioItemV1,
  isPaidFor,
  paidAmounts,
  sumByCurrency,
} from "@auction/lax-ecosystem";
import {
  ACTION_LABELS,
  COST_LINE_LABELS,
  DOCUMENT_LABELS,
  PRODUCT_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
  type StatusStyle,
} from "./portfolio-labels";
import { safeDeepLink } from "./safe-deep-link";

export const NO_VALUATION_NOTE =
  "No valuation yet. Any future value will be an estimate, shown with its method and date.";

const DOCUMENT_PENDING_NOTE = "We'll add it here when it's ready.";

export type WorkCostLineVm = {
  key: string;
  label: string;
  amount: number;
  currency: string;
  /** Money taken off the lines above it; shown as a negative amount. */
  deduction: boolean;
};
export type WorkDocumentVm = {
  key: string;
  label: string;
  /** Present only for a document that exists and has a usable link. */
  href: string | null;
  /** Says when a missing document arrives. */
  note: string | null;
};
export type WorkActionVm = { key: string; label: string; href: string };

export type WorkDetailVm = {
  title: string;
  artist: string;
  /** Which print this is: "No. 7 of 24 · Hand-signed". Null for a work with no edition to describe. */
  edition: string | null;
  image: string | null;
  statusLabel: string;
  statusStyle: StatusStyle;
  productLabel: string;
  businessName: string;
  acquiredAt: string;
  /** Each cost line in the currency it was charged in. */
  costLines: WorkCostLineVm[];
  /** Everything except shipping, per currency; never converted or combined. */
  /** What the listed cost lines come to, delivery included: the amount paid, or the amount due. */
  total: CurrencyTotal[];
  shipping: CurrencyTotal[];
  /** True while the invoice is unpaid, so the amounts read as due rather than paid. */
  costsAreDue: boolean;
  /** The payment is made and still being confirmed: the amount is neither due nor paid. */
  paymentConfirming: boolean;
  documents: WorkDocumentVm[];
  actions: WorkActionVm[];
  valueNote: string;
};

export function findWork(
  items: readonly LaxPortfolioItemV1[],
  product: string,
  id: string,
): LaxPortfolioItemV1 | undefined {
  return items.find((item) => item.product === product && item.id === id);
}

function documentVm(doc: LaxPortfolioItemV1["documents"][number]): WorkDocumentVm {
  const href = doc.available ? safeDeepLink(doc.href) : null;
  return {
    key: doc.kind,
    label: doc.label ?? DOCUMENT_LABELS[doc.kind],
    href,
    note: href ? null : (doc.expectedNote ?? DOCUMENT_PENDING_NOTE),
  };
}

/** The charges as made, then any refund as its own line so no charge reads lower than it was. */
function costLines(item: LaxPortfolioItemV1): WorkCostLineVm[] {
  const charges = item.paid.lines.map((line, index) => ({
    key: `${line.kind}-${line.currency}-${index}`,
    label: COST_LINE_LABELS[line.kind],
    amount: line.amount,
    currency: line.currency,
    deduction: false,
  }));
  const { refunded } = item.paid;
  if (!refunded || refunded.amount === 0) return charges;
  return [
    ...charges,
    {
      key: `refunded-${refunded.currency}`,
      label: "Refunded",
      amount: refunded.amount,
      currency: refunded.currency,
      deduction: true,
    },
  ];
}

export function buildWorkDetail(
  item: LaxPortfolioItemV1,
  imageOrigins: readonly string[],
): WorkDetailVm {
  const documents = item.documents.map(documentVm);
  const actions = item.actions.flatMap((action) => {
    const href = safeDeepLink(action.href);
    return href ? [{ key: action.kind, label: ACTION_LABELS[action.kind], href }] : [];
  });
  return {
    title: item.title || "Untitled work",
    artist: item.artist,
    edition: item.edition ?? null,
    image: safeImageUrl(item.image, imageOrigins),
    statusLabel: STATUS_LABELS[item.status],
    statusStyle: STATUS_STYLES[item.status],
    productLabel: PRODUCT_LABELS[item.product],
    businessName: item.business.legalName,
    acquiredAt: item.acquiredAt,
    costLines: costLines(item),
    total: sumByCurrency(isPaidFor(item) ? paidAmounts(item) : item.paid.lines),
    shipping: sumByCurrency(item.paid.lines.filter((line) => line.kind === "shipping")),
    costsAreDue: item.status === "awaiting_payment",
    paymentConfirming: item.status === "payment_confirming",
    // Documents that exist come first; the ones still to come follow with their note.
    documents: [...documents.filter((doc) => doc.href), ...documents.filter((doc) => !doc.href)],
    actions,
    valueNote: NO_VALUATION_NOTE,
  };
}
