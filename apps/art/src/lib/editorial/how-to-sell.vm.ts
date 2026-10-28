import type { LaxProductLinkVm } from "@auction/lax-ecosystem";
import type { LaxAccountDestination } from "@auction/lax-ecosystem/lax-account-origin";

/** One way to sell, offered on "How to sell". lax.art itself does not take consignments. */
export type SellingRouteVm = {
  id: "collector" | "artist";
  title: string;
  description: string;
  action: { label: string; href: string; productName: string };
};

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
  const bid = bidBaseUrl(input.crossProductLinks);
  if (bid) {
    routes.push({
      id: "collector",
      title: "You own a work",
      description:
        "Sell it at auction with LAX Bid. A specialist values the work and guides you from estimate to sale.",
      action: {
        label: "Sell with LAX",
        href: new URL(BID_SELL_PATH, bid).toString(),
        productName: "LAX Bid",
      },
    });
  }
  routes.push({
    id: "artist",
    title: "You are an artist",
    description:
      "Artists the gallery represents manage their works, editions and sales in the artist portal.",
    action: {
      label: "Open the artist portal",
      href: input.laxAccountUrl("sellingArtworks"),
      productName: "LAX Account",
    },
  });
  return routes;
}
