import {
  type CurrencyTotal,
  type LaxPortfolioItemV1,
  costBasisLines,
  sumByCurrency,
} from "@auction/lax-ecosystem";
import {
  ACTION_LABELS,
  COST_LINE_LABELS,
  DOCUMENT_LABELS,
  PRODUCT_LABELS,
  STATUS_LABELS,
  STATUS_TONES,
  type StatusTone,
} from "./portfolio-labels";
import { safeDeepLink } from "./safe-deep-link";

export const NO_VALUATION_NOTE =
  "No valuation yet. Any future value will be an estimate, shown with its method and date.";

const DOCUMENT_PENDING_NOTE = "We'll add it here when it's ready.";

export type WorkCostLineVm = { key: string; label: string; amount: number; currency: string };
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
  image: string | null;
  statusLabel: string;
  statusTone: StatusTone;
  productLabel: string;
  businessName: string;
  acquiredAt: string;
  /** Each cost line in the currency it was charged in. */
  costLines: WorkCostLineVm[];
  /** Everything except shipping, per currency; never converted or combined. */
  costBasis: CurrencyTotal[];
  shipping: CurrencyTotal[];
  /** True while the invoice is unpaid, so the amounts read as due rather than paid. */
  costsAreDue: boolean;
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
    label: DOCUMENT_LABELS[doc.kind],
    href,
    note: href ? null : (doc.expectedNote ?? DOCUMENT_PENDING_NOTE),
  };
}

export function buildWorkDetail(item: LaxPortfolioItemV1): WorkDetailVm {
  const documents = item.documents.map(documentVm);
  const actions = item.actions.flatMap((action) => {
    const href = safeDeepLink(action.href);
    return href ? [{ key: action.kind, label: ACTION_LABELS[action.kind], href }] : [];
  });
  return {
    title: item.title || "Untitled work",
    artist: item.artist,
    image: safeDeepLink(item.image ?? undefined),
    statusLabel: STATUS_LABELS[item.status],
    statusTone: STATUS_TONES[item.status],
    productLabel: PRODUCT_LABELS[item.product],
    businessName: item.business.legalName,
    acquiredAt: item.acquiredAt,
    costLines: item.paid.lines.map((line, index) => ({
      key: `${line.kind}-${line.currency}-${index}`,
      label: COST_LINE_LABELS[line.kind],
      amount: line.amount,
      currency: line.currency,
    })),
    costBasis: sumByCurrency(costBasisLines(item)),
    shipping: sumByCurrency(item.paid.lines.filter((line) => line.kind === "shipping")),
    costsAreDue: item.status === "awaiting_payment",
    // Documents that exist come first; the ones still to come follow with their note.
    documents: [...documents.filter((doc) => doc.href), ...documents.filter((doc) => !doc.href)],
    actions,
    valueNote: NO_VALUATION_NOTE,
  };
}
