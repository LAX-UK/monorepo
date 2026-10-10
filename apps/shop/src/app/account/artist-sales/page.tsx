import { ShopAccountShell } from "@/components/account/shop-account-shell";
import {
  ShopArtistNotLinkedActions,
  shopArtistNotLinkedNotice,
} from "@/components/account/shop-artist-not-linked";
import { formatPortalSaleChannel } from "@/lib/presenters/portal-sale-channel.presenter";
import {
  fetchPortalArtistSales,
  resolveShopArtistPortalLinked,
  resolveShopPortalOwnershipEnabled,
} from "@/lib/shop-portal.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { isShopPayoutsEnabled } from "@/lib/shop-runtime-flags";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageTitle("Artist sales");

function formatPence(pence: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100);
}

export default async function ShopAccountArtistSalesPage() {
  const viewer = await loadShopViewerState();
  const portalOwnershipEnabled = await resolveShopPortalOwnershipEnabled();
  const artistPortalEnabled = await resolveShopArtistPortalLinked();
  const payoutsEnabled = isShopPayoutsEnabled();
  const gate = gateShopAuthenticatedRoute(viewer, "/account/artist-sales");
  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    redirect("/account");
  }

  const result = await fetchPortalArtistSales();
  const notLinked = result.status === "ok" && !result.data.artist;

  return (
    <ShopAccountShell
      title="Artist sales"
      breadcrumbs={[
        { label: "Shop", href: "/" },
        { label: "Account", href: "/account" },
        { label: "Artist sales" },
      ]}
      activeNavHref="/account/artist-sales"
      portalOwnershipEnabled={portalOwnershipEnabled}
      payoutsEnabled={payoutsEnabled}
      artistPortalEnabled={artistPortalEnabled}
      {...(notLinked ? { notice: shopArtistNotLinkedNotice } : {})}
    >
      {notLinked ? (
        <ShopArtistNotLinkedActions />
      ) : result.status === "unauthorized" ? (
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
              {formatPortalSaleChannel(row.channel)} · {formatPence(row.grossPence)}
            </li>
          ))}
          {result.data.items.length === 0 ? <li>No sales recorded yet.</li> : null}
        </ul>
      )}
    </ShopAccountShell>
  );
}
