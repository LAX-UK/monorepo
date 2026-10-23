import type { LaxPortfolioActionV1, LaxPortfolioItemV1 } from "@auction/lax-ecosystem";
import { workDetailHref } from "./portfolio-routes";
import { safeDeepLink } from "./safe-deep-link";

export type AttentionRowVm = {
  key: string;
  text: string;
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
  switch (item.status) {
    case "awaiting_payment": {
      const pay = actionHref(item, "pay");
      return { key, text: `Pay for ${title}`, ...(pay ? { href: pay, external: true } : detail) };
    }
    case "awaiting_shipment": {
      const track = actionHref(item, "track_shipping");
      return {
        key,
        text: `Track shipping for ${title}`,
        ...(track ? { href: track, external: true } : detail),
      };
    }
    case "payout_pending":
      return { key, text: `Payout pending for ${title}`, ...detail };
    default: {
      const invoiceMissing = item.documents.some((doc) => doc.kind === "invoice" && !doc.available);
      return invoiceMissing
        ? { key, text: `Invoice for ${title} is not available yet`, ...detail }
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
