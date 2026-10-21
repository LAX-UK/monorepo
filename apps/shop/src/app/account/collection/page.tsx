import { ShopAccountShell } from "@/components/account/shop-account-shell";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import {
  resolvePortalCustodyStatusPresentation,
  resolvePortalListingStatusPresentation,
  resolvePortalOriginalSaleStatusPresentation,
} from "@/lib/presenters/shop-status-presentation";
import {
  fetchPortalCollection,
  resolveShopArtistPortalLinked,
  resolveShopPortalOwnershipEnabled,
} from "@/lib/shop-portal.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { isShopPayoutsEnabled } from "@/lib/shop-runtime-flags";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { FOCUS_RING } from "@auction/branding";
import { cn } from "@auction/ui";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageTitle("Collection");

const SALES_CHANNEL_LABEL = { shop: "LAX Shop", art: "LAX Art" } as const;

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
      ) : result.status === "commerce_unavailable" ? (
        <ShopStatusState
          layout="page"
          variant="error"
          title="Collection not available yet"
          titleAs="h2"
          description="This environment has not turned on the owner portal yet."
          actions={<ShopStatusStateLink href="/account">Back to account</ShopStatusStateLink>}
        />
      ) : result.status === "failed" ? (
        <ShopStatusState
          layout="page"
          variant="error"
          title="Could not load your collection"
          titleAs="h2"
          description="Try again later or contact support if this persists."
          actions={<ShopCatalogueStateRetryButton />}
        />
      ) : result.status === "empty" || result.data.length === 0 ? (
        <ShopStatusState
          layout="page"
          variant="empty"
          title="No works yet"
          titleAs="h2"
          description="Originals and editions you buy from LAX Shop and LAX Art appear here."
          actions={
            <ShopStatusStateLink href="/artworks" priority="primary">
              Explore artworks
            </ShopStatusStateLink>
          }
        />
      ) : (
        <ul className="shop-account-list">
          {result.data.map((item) => {
            const pills =
              item.kind === "edition"
                ? [
                    resolvePortalListingStatusPresentation(item.listingStatus),
                    resolvePortalCustodyStatusPresentation(item.custodyStatus),
                  ]
                : [resolvePortalOriginalSaleStatusPresentation(item.status)];
            return (
              <li
                key={item.kind === "edition" ? item.editionId : item.originalSaleId}
                className="shop-account-list__row"
              >
                <p className="font-medium text-on-surface">
                  <Link
                    href={`/artworks/${encodeURIComponent(item.artworkSlug)}`}
                    className={cn("text-link underline underline-offset-4", FOCUS_RING)}
                  >
                    {item.artworkTitle}
                  </Link>
                </p>
                <p className="text-on-surface-variant">
                  {item.kind === "edition"
                    ? `Edition ${item.editionNumber}`
                    : `Original · acquired ${new Date(item.acquiredAt).toLocaleDateString("en-GB")}`}
                  {` · ${SALES_CHANNEL_LABEL[item.salesChannel]}`}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {pills.map((pill) => (
                    <DotStatusPill key={pill.label} label={pill.label} tone={pill.tone} />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {payoutsEnabled ? (
        <p className="text-sm text-on-surface-variant">
          <Link
            href="/account/documents"
            className={cn("text-link underline underline-offset-4", FOCUS_RING)}
          >
            Documents
          </Link>{" "}
          holds the certificates and invoices for your works.
        </p>
      ) : null}
    </ShopAccountShell>
  );
}
