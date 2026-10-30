import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import type { LaxAccountDestination } from "@auction/lax-ecosystem/lax-account-origin";

/** One way to sell, offered on "How to sell". lax.art itself does not take consignments. */
export type SellingRouteVm = {
  id: "collector" | "artist";
  title: string;
  description: string;
  action: { label: string; href: string; productName: string };
};

import { FOR_ARTISTS_PATH } from "@/lib/artist-application/for-artists.content";

/** Bid's own path for a consignment ("Sell with LAX"). */
const BID_SELL_PATH = "/sell";

function bidBaseUrl(links: readonly LaxProductLinkVm[]): URL | null {
  const bid = links.find((link) => link.id === "bid");
  if (!bid) return null;
  try {
    return new URL(bid.href);
  } catch {
    return null;
  }
}

/** LAX Bid's "Sell with LAX" page, where collectors sell; null when this deployment has no Bid. */
export function bidSellUrl(links: readonly LaxProductLinkVm[]): string | null {
  const bid = bidBaseUrl(links);
  return bid ? new URL(BID_SELL_PATH, bid).toString() : null;
}

/**
 * Collectors sell through LAX Bid's "Sell with LAX"; artists the gallery represents use the
 * artist portal in LAX Account. Without a Bid URL in this deployment the collector route is left
 * out rather than linking nowhere.
 */
export function buildSellingRoutes(input: {
  crossProductLinks: readonly LaxProductLinkVm[];
  laxAccountUrl: (page: LaxAccountDestination) => string;
}): SellingRouteVm[] {
  const routes: SellingRouteVm[] = [];
  const sellHref = bidSellUrl(input.crossProductLinks);
  if (sellHref) {
    routes.push({
      id: "collector",
      title: "You own a work",
      description:
        "Sell it at auction with LAX Bid. A specialist values the work and guides you from estimate to sale.",
      action: {
        label: "Sell with LAX",
        href: sellHref,
        productName: "LAX Bid",
      },
    });
  }
  routes.push({
    id: "artist",
    title: "You are an artist",
    description:
      "Apply to be represented by the gallery. Artists we represent manage their works, editions and sales in the artist portal.",
    action: { label: "Apply to join", href: FOR_ARTISTS_PATH, productName: "lax.art" },
  });
  return routes;
}
