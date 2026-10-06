import { ShopAccountShell } from "@/components/account/shop-account-shell";
import {
  fetchPortalArtistArtworks,
  resolveShopArtistPortalLinked,
  resolveShopPortalOwnershipEnabled,
} from "@/lib/shop-portal.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { isShopPayoutsEnabled } from "@/lib/shop-runtime-flags";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { notFound, redirect } from "next/navigation";

export const metadata = shopPrivatePageTitle("My artworks");

export default async function ShopAccountArtworksPage() {
  const viewer = await loadShopViewerState();
  const portalOwnershipEnabled = await resolveShopPortalOwnershipEnabled();
  const artistPortalEnabled = await resolveShopArtistPortalLinked();
  const payoutsEnabled = isShopPayoutsEnabled();
  const gate = gateShopAuthenticatedRoute(viewer, "/account/artworks");
  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    redirect("/account");
  }

  const result = await fetchPortalArtistArtworks();
  if (result.status === "commerce_unavailable") notFound();
  if (result.status === "ok" && !result.data.artist) {
    notFound();
  }

  return (
    <ShopAccountShell
      title="My artworks"
      breadcrumbs={[
        { label: "Shop", href: "/" },
        { label: "Account", href: "/account" },
        { label: "My artworks" },
      ]}
      activeNavHref="/account/artworks"
      portalOwnershipEnabled={portalOwnershipEnabled}
      payoutsEnabled={payoutsEnabled}
      artistPortalEnabled={artistPortalEnabled}
    >
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
