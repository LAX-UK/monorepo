import { SaleLimitRequestForm } from "@/components/account/sale-limit-request-form.client";
import { ShopAccountBodyText, ShopAccountShell } from "@/components/account/shop-account-shell";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import {
  fetchPortalSaleAuthority,
  fetchPortalSaleAuthorityRequests,
  resolveShopPortalOwnershipEnabled,
} from "@/lib/shop-portal.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { isShopPayoutsEnabled } from "@/lib/shop-runtime-flags";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageTitle("Sale limits");

export default async function ShopAccountSaleLimitsPage() {
  const viewer = await loadShopViewerState();
  const portalOwnershipEnabled = await resolveShopPortalOwnershipEnabled();
  const payoutsEnabled = isShopPayoutsEnabled();
  const shellNav = {
    activeNavHref: "/account/sale-limits",
    portalOwnershipEnabled,
    payoutsEnabled,
  };

  const gate = gateShopAuthenticatedRoute(viewer, "/account/sale-limits");
  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    return (
      <ShopAccountShell
        title={shopPageWayfinding.accountSaleLimits.title}
        breadcrumbs={shopPageWayfinding.accountSaleLimits.breadcrumbs}
        {...shellNav}
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
      </ShopAccountShell>
    );
  }

  const [result, requests] = await Promise.all([
    fetchPortalSaleAuthority(),
    fetchPortalSaleAuthorityRequests(),
  ]);

  return (
    <ShopAccountShell
      title={shopPageWayfinding.accountSaleLimits.title}
      breadcrumbs={shopPageWayfinding.accountSaleLimits.breadcrumbs}
      {...shellNav}
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
          actions={<ShopCatalogueStateRetryButton />}
        />
      ) : result.status === "empty" ? (
        <ShopStatusState
          layout="page"
          variant="empty"
          title="No sale authority records yet"
          titleAs="h2"
          description="When staff grant sale authority for your artworks, authorised and committed counts will appear here."
          actions={
            <ShopStatusStateLink href="/account/editions" priority="primary">
              View my editions
            </ShopStatusStateLink>
          }
        />
      ) : (
        <>
          <ShopAccountBodyText>
            These limits show how many of your editions are authorised for sale. Submit a change
            request below and staff will review it.
          </ShopAccountBodyText>
          <ul className="shop-account-list">
            {result.data.map((row) => (
              <li key={row.artworkId} className="shop-account-list__row">
                <p className="font-medium text-on-surface">{row.artworkTitle}</p>
                <dl className="shop-account-list__facts">
                  <div>
                    <dt>Authorised</dt>
                    <dd>{row.authorisedCount}</dd>
                  </div>
                  <div>
                    <dt>Committed</dt>
                    <dd>{row.committedCount}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          <SaleLimitRequestForm artworks={result.data} />
          {requests.status === "ok" && requests.data.length > 0 ? (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-on-surface">Your requests</h2>
              <ul className="shop-account-list">
                {requests.data.map((row) => (
                  <li key={row.requestId} className="shop-account-list__row">
                    <p className="font-medium text-on-surface">{row.artworkTitle}</p>
                    <p className="text-on-surface-variant">
                      {row.requestedCount} requested · {row.status} ·{" "}
                      {new Date(row.createdAt).toLocaleDateString("en-GB")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </ShopAccountShell>
  );
}
