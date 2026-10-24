import { ShopAccountShell } from "@/components/account/shop-account-shell";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { buildShopAccountNavItems } from "@/lib/account/account-nav.vm";
import { SHOP_ORDERS_HREF } from "@/lib/account/shop-account-routes";
import { requireShopSellerTool } from "@/lib/account/shop-seller-access.server";
import { fetchPortalArtistArtworks } from "@/lib/shop-portal.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageTitle("My artworks");

const { title, breadcrumbs } = shopPageWayfinding.accountArtworks;

export default async function ShopAccountArtworksPage() {
  const viewer = await loadShopViewerState();
  const gate = gateShopAuthenticatedRoute(viewer, "/account/artworks");
  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    redirect(SHOP_ORDERS_HREF);
  }

  const access = await requireShopSellerTool("artworks");
  const nav = buildShopAccountNavItems({ access, activeHref: "/account/artworks" });
  const result = await fetchPortalArtistArtworks();

  return (
    <ShopAccountShell title={title} breadcrumbs={breadcrumbs} nav={nav}>
      {result.status === "unauthorized" ? (
        <p>
          <a href={shopStorefrontLoginHref("/account/artworks")}>Sign in</a> to view your artworks.
        </p>
      ) : result.status !== "ok" ? (
        <p>We could not load your artworks right now.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {result.data.items.map((row) => (
            <li key={row.artworkId}>
              {row.title} <span className="text-on-surface-variant">({row.saleState})</span>
            </li>
          ))}
          {result.data.items.length === 0 ? <li>No artworks listed yet.</li> : null}
        </ul>
      )}
    </ShopAccountShell>
  );
}
