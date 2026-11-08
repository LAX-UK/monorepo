import type { LaxPortfolioActionV1, LaxPortfolioItemV1 } from "@auction/lax-ecosystem";
import { PRODUCT_LABELS } from "./portfolio-labels";
import { workDetailHref } from "./portfolio-routes";
import { safeDeepLink } from "./safe-deep-link";

export type AttentionKind = "pay" | "held" | "send" | "confirming" | "track" | "payout" | "invoice";

export type AttentionRowVm = {
  key: string;
  kind: AttentionKind;
  text: string;
  /** The work's title, for views that word the line themselves. */
  workTitle: string;
  /** What is owed, for views that show the amount beside a payment line. */
  owed: { amount: number; currency: string } | null;
  /** The product that owns the next step, named in the row's secondary line. */
  productLabel: string;
  href: string;
  /** True when the link leaves Account for the product that owns the next step. */
  external: boolean;
};

function actionHref(item: LaxPortfolioItemV1, kind: LaxPortfolioActionV1["kind"]): string | null {
  return safeDeepLink(item.actions.find((action) => action.kind === kind)?.href);
}

function rowFor(item: LaxPortfolioItemV1): AttentionRowVm | null {
  const key = `${item.product}:${item.id}`;
  const detail = { href: workDetailHref(item), external: false };
  const title = item.title || "Untitled work";
  const base = {
    key,
    workTitle: title,
    owed: item.owed ? { amount: item.owed.amount, currency: item.owed.currency } : null,
    productLabel: PRODUCT_LABELS[item.product],
  };
  switch (item.status) {
    case "awaiting_payment": {
      // A bank transfer that has delivered part of the payment is finished by sending the rest.
      if (item.owed?.state === "still_to_send") {
        return {
          ...base,
          kind: "send",
          text: `Send the rest of the transfer for ${title}`,
          ...detail,
        };
      }
      const pay = actionHref(item, "pay");
      const target = pay ? { href: pay, external: true } : detail;
      // Payment cannot start while the account's checks are open; the product's page is where
      // the person completes them.
      if (item.owed?.state === "in_review") {
        return { ...base, kind: "held", text: `${title} is waiting on account checks`, ...target };
      }
      return { ...base, kind: "pay", text: `Pay for ${title}`, ...target };
    }
    case "payment_confirming":
      return {
        ...base,
        kind: "confirming",
        text: `Payment for ${title} is being confirmed`,
        ...detail,
      };
    case "awaiting_shipment": {
      const track = actionHref(item, "track_shipping");
      return {
        ...base,
        kind: "track",
        text: `Track shipping for ${title}`,
        ...(track ? { href: track, external: true } : detail),
      };
    }
    case "payout_pending":
      return { ...base, kind: "payout", text: `Payout pending for ${title}`, ...detail };
    default: {
      const invoiceMissing = item.documents.some((doc) => doc.kind === "invoice" && !doc.available);
      return invoiceMissing
        ? { ...base, kind: "invoice", text: `Invoice for ${title} is not available yet`, ...detail }
        : null;
    }
  }
}

/**
 * What needs the person next: an unpaid invoice, a shipment to follow, a payout in progress, or
 * a missing invoice. Each row opens the product that owns the step, or the work's page when the
 * product gave no usable link.
 */
export function buildAttentionRows(items: readonly LaxPortfolioItemV1[]): AttentionRowVm[] {
  return items.flatMap((item) => rowFor(item) ?? []);
}
