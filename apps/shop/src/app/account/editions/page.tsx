import { ShopAccountLinkButton, ShopAccountShell } from "@/components/account/shop-account-shell";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import {
  resolvePortalCustodyStatusPresentation,
  resolvePortalListingStatusPresentation,
} from "@/lib/presenters/shop-status-presentation";
import { fetchPortalEditions } from "@/lib/shop-portal.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageTitle("My editions");

export default async function ShopAccountEditionsPage() {
  const viewer = await loadShopViewerState();
  const gate = gateShopAuthenticatedRoute(viewer, "/account/editions");
  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    return (
      <ShopAccountShell
        title={shopPageWayfinding.accountEditions.title}
        breadcrumbs={shopPageWayfinding.accountEditions.breadcrumbs}
        notice={{
          variant: "warning",
          title: "Unavailable",
          description:
            viewer.kind === "unavailable"
              ? viewer.message
              : "We could not verify your session. Try again shortly.",
        }}
      >
        <ShopCatalogueStateRetryButton />
        <ShopAccountLinkButton href="/account" label="Back to account" variant="outline" />
      </ShopAccountShell>
    );
  }

  const result = await fetchPortalEditions();

  return (
    <ShopAccountShell
      title={shopPageWayfinding.accountEditions.title}
      breadcrumbs={shopPageWayfinding.accountEditions.breadcrumbs}
    >
      {result.status === "unauthorized" ? (
        <ShopStatusState
          layout="page"
          variant="error"
          title="Sign in again"
          titleAs="h2"
          description="Your session ended before we could load your editions."
          actions={
            <ShopStatusStateLink
              href={shopStorefrontLoginHref("/account/editions")}
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
          title="Ownership portal not enabled"
          titleAs="h2"
          description="This environment has not turned on the owner portal yet."
          actions={<ShopStatusStateLink href="/account">Back to account</ShopStatusStateLink>}
        />
      ) : result.status === "failed" ? (
        <ShopStatusState
          layout="page"
          variant="error"
          title="Could not load editions"
          titleAs="h2"
          description="Try again later or contact support if this persists."
          actions={
            <>
              <ShopCatalogueStateRetryButton />
              <ShopStatusStateLink href="/account">Back to account</ShopStatusStateLink>
            </>
          }
        />
      ) : result.status === "empty" ? (
        <ShopStatusState
          layout="page"
          variant="empty"
          title="No owned editions yet"
          titleAs="h2"
          description="When you own numbered editions, they will appear here with listing and custody status."
          actions={
            <>
              <ShopStatusStateLink href="/artworks" priority="primary">
                Explore artworks
              </ShopStatusStateLink>
              <ShopStatusStateLink href="/account">Back to account</ShopStatusStateLink>
            </>
          }
        />
      ) : (
        <>
          <ul className="space-y-3 text-sm">
            {result.data.map((edition) => {
              const listing = resolvePortalListingStatusPresentation(edition.listingStatus);
              const custody = resolvePortalCustodyStatusPresentation(edition.custodyStatus);
              return (
                <li
                  key={edition.editionId}
                  className="rounded-md border border-outline-variant p-3"
                >
                  <p className="font-medium text-on-surface">{edition.artworkTitle}</p>
                  <p className="text-on-surface-variant">Edition {edition.editionNumber}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <DotStatusPill label={listing.label} tone={listing.tone} />
                    <DotStatusPill label={custody.label} tone={custody.tone} />
                  </div>
                </li>
              );
            })}
          </ul>
          <ShopAccountLinkButton
            href="/account/sale-limits"
            label="Sale limits"
            variant="outline"
          />
          <ShopAccountLinkButton href="/account" label="Back to account" variant="outline" />
        </>
      )}
    </ShopAccountShell>
  );
}
