import { ShopAccountShell } from "@/components/account/shop-account-shell";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import {
  fetchPortalCollection,
  resolveShopArtistPortalLinked,
  resolveShopPortalOwnershipEnabled,
} from "@/lib/shop-portal.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { isShopPayoutsEnabled } from "@/lib/shop-runtime-flags";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageTitle("Collection");

export default async function ShopAccountCollectionPage() {
  const viewer = await loadShopViewerState();
  const portalOwnershipEnabled = await resolveShopPortalOwnershipEnabled();
  const artistPortalEnabled = await resolveShopArtistPortalLinked();
  const payoutsEnabled = isShopPayoutsEnabled();
  const shellNav = {
    activeNavHref: "/account/collection",
    portalOwnershipEnabled,
    payoutsEnabled,
    artistPortalEnabled,
  };

  const gate = gateShopAuthenticatedRoute(viewer, "/account/collection");
  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    return (
      <ShopAccountShell
        title="Collection"
        breadcrumbs={shopPageWayfinding.account.breadcrumbs}
        {...shellNav}
      >
        <ShopCatalogueStateRetryButton />
      </ShopAccountShell>
    );
  }

  const result = await fetchPortalCollection();

  return (
    <ShopAccountShell
      title="Collection"
      breadcrumbs={[
        ...shopPageWayfinding.account.breadcrumbs,
        { label: "Collection", href: "/account/collection" },
      ]}
      {...shellNav}
    >
      {result.status === "unauthorized" ? (
        <ShopStatusState
          layout="page"
          variant="error"
          title="Sign in again"
          titleAs="h2"
          description="Sign in to view your collection."
          actions={
            <ShopStatusStateLink
              href={shopStorefrontLoginHref("/account/collection")}
              priority="primary"
            >
              Sign in
            </ShopStatusStateLink>
          }
        />
      ) : result.status !== "ok" ? (
        <ShopCatalogueStateRetryButton />
      ) : result.data.length === 0 ? (
        <ShopStatusState
          layout="page"
          variant="empty"
          title="No works yet"
          titleAs="h2"
          description="Owned originals and editions from LAX Shop and lax.art appear here."
        />
      ) : (
        <ul className="divide-y divide-outline-variant rounded-md border border-outline-variant">
          {result.data.map((item) => (
            <li
              key={item.kind === "edition" ? item.editionId : item.originalSaleId}
              className="p-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/artworks/${item.artworkSlug}`} className="font-medium text-primary">
                  {item.artworkTitle}
                </Link>
                <span className="text-xs uppercase tracking-wide text-on-surface-variant">
                  {item.salesChannel} · {item.kind}
                </span>
              </div>
              {item.kind === "edition" ? (
                <p className="mt-1 text-sm text-on-surface-variant">
                  Edition {item.editionNumber} · {item.listingStatus} · {item.custodyStatus}
                </p>
              ) : (
                <p className="mt-1 text-sm text-on-surface-variant">
                  Original · {item.status} · acquired{" "}
                  {new Date(item.acquiredAt).toLocaleDateString()}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-on-surface-variant">
        <Link href="/account/documents" className="text-primary underline">
          Documents
        </Link>{" "}
        for certificates and invoices linked to your party.
      </p>
    </ShopAccountShell>
  );
}
