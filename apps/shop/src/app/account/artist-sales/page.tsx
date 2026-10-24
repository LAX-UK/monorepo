import { ShopAccountShell } from "@/components/account/shop-account-shell";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { buildShopAccountNavItems } from "@/lib/account/account-nav.vm";
import { SHOP_ORDERS_HREF } from "@/lib/account/shop-account-routes";
import { requireShopSellerTool } from "@/lib/account/shop-seller-access.server";
import { fetchPortalArtistSales } from "@/lib/shop-portal.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { formatPortalSaleChannel } from "@auction/shop-portal/vm";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageTitle("Artist sales");

const { title, breadcrumbs } = shopPageWayfinding.accountArtistSales;

function formatPence(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

export default async function ShopAccountArtistSalesPage() {
  const viewer = await loadShopViewerState();
  const gate = gateShopAuthenticatedRoute(viewer, "/account/artist-sales");
  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    redirect(SHOP_ORDERS_HREF);
  }

  const access = await requireShopSellerTool("artist-sales");
  const nav = buildShopAccountNavItems({ access, activeHref: "/account/artist-sales" });
  const result = await fetchPortalArtistSales();

  return (
    <ShopAccountShell title={title} breadcrumbs={breadcrumbs} nav={nav}>
      {result.status === "unauthorized" ? (
        <p>
          <a href={shopStorefrontLoginHref("/account/artist-sales")}>Sign in</a> to view artist
          sales.
        </p>
      ) : result.status !== "ok" ? (
        <p>We could not load artist sales right now.</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {result.data.items.map((row) => (
            <li key={row.saleId}>
              <span className="font-medium">{row.artworkTitle}</span> ·{" "}
              {formatPortalSaleChannel(row.channel)} · gross {formatPence(row.grossPence)}
              {row.netPence != null ? ` · net ${formatPence(row.netPence)}` : ""}
              {row.feesPence != null ? ` · fees ${formatPence(row.feesPence)}` : ""}
              {row.arrApplicable ? " · ARR" : ""}
            </li>
          ))}
          {result.data.items.length === 0 ? <li>No sales recorded yet.</li> : null}
        </ul>
      )}
    </ShopAccountShell>
  );
}
