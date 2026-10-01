import {
  ShopAccountBodyText,
  ShopAccountLinkButton,
  ShopAccountShell,
} from "@/components/account/shop-account-shell";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { fetchPortalSaleAuthority } from "@/lib/shop-portal.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageTitle("Sale limits");

export default async function ShopAccountSaleLimitsPage() {
  const viewer = await loadShopViewerState();
  const gate = gateShopAuthenticatedRoute(viewer, "/account/sale-limits");
  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    return (
      <ShopAccountShell
        title={shopPageWayfinding.accountSaleLimits.title}
        breadcrumbs={shopPageWayfinding.accountSaleLimits.breadcrumbs}
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

  const result = await fetchPortalSaleAuthority();

  return (
    <ShopAccountShell
      title={shopPageWayfinding.accountSaleLimits.title}
      breadcrumbs={shopPageWayfinding.accountSaleLimits.breadcrumbs}
    >
      {result.status === "unauthorized" ? (
        <ShopStatusState
          layout="page"
          variant="error"
          title="Sign in again"
          titleAs="h2"
          description="Your session ended before we could load your sale limits."
          actions={
            <ShopStatusStateLink
              href={shopStorefrontLoginHref("/account/sale-limits")}
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
          title="Could not load sale limits"
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
          title="No sale authority records yet"
          titleAs="h2"
          description="When staff grant sale authority for your artworks, authorised and committed counts will appear here."
          actions={
            <>
              <ShopStatusStateLink href="/account/editions" priority="primary">
                View my editions
              </ShopStatusStateLink>
              <ShopStatusStateLink href="/account">Back to account</ShopStatusStateLink>
            </>
          }
        />
      ) : (
        <>
          <ShopAccountBodyText>
            These limits show how many of your editions are authorised for sale. Contact your
            account manager to request changes.
          </ShopAccountBodyText>
          <ul className="space-y-3 text-sm">
            {result.data.map((row) => (
              <li key={row.artworkId} className="rounded-md border border-outline-variant p-3">
                <p className="font-medium text-on-surface">{row.artworkTitle}</p>
                <p className="text-on-surface-variant">
                  Authorised: {row.authorisedCount} · Committed: {row.committedCount}
                </p>
              </li>
            ))}
          </ul>
          <ShopAccountLinkButton href="/account/editions" label="My editions" variant="outline" />
          <ShopAccountLinkButton href="/account" label="Back to account" variant="outline" />
        </>
      )}
    </ShopAccountShell>
  );
}
