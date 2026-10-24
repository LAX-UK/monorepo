import { SaleLimitRequestForm } from "@/components/account/sale-limit-request-form.client";
import { ShopAccountBodyText, ShopAccountShell } from "@/components/account/shop-account-shell";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { buildShopAccountNavItems } from "@/lib/account/account-nav.vm";
import { SHOP_ORDERS_HREF } from "@/lib/account/shop-account-routes";
import { requireShopSellerTool } from "@/lib/account/shop-seller-access.server";
import { LAX_ACCOUNT_PATHS, laxAccountUrl } from "@/lib/lax-account-url";
import {
  fetchPortalSaleAuthority,
  fetchPortalSaleAuthorityRequests,
} from "@/lib/shop-portal.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { formatPortalSaleAuthorityRequestStatus, formatShopDate } from "@auction/shop-portal/vm";
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
      </ShopAccountShell>
    );
  }

  const access = await requireShopSellerTool("sale-limits");
  const nav = buildShopAccountNavItems({ access, activeHref: "/account/sale-limits" });
  const [result, requests] = await Promise.all([
    fetchPortalSaleAuthority(),
    fetchPortalSaleAuthorityRequests(),
  ]);

  return (
    <ShopAccountShell
      title={shopPageWayfinding.accountSaleLimits.title}
      breadcrumbs={shopPageWayfinding.accountSaleLimits.breadcrumbs}
      nav={nav}
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
          actions={
            <ShopStatusStateLink href={SHOP_ORDERS_HREF}>Back to your orders</ShopStatusStateLink>
          }
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
            <ShopStatusStateLink
              href={laxAccountUrl(LAX_ACCOUNT_PATHS.shopPortfolio)}
              priority="primary"
            >
              View your editions in LAX Account
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
                  {row.lastGrantAt ? (
                    <div>
                      <dt>Last grant</dt>
                      <dd>{formatShopDate(row.lastGrantAt)}</dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            ))}
          </ul>
          <SaleLimitRequestForm artworks={result.data} />
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-on-surface">Your requests</h2>
            {requests.status === "unauthorized" ? (
              <ShopStatusState
                layout="inline"
                variant="error"
                title="Sign in again"
                titleAs="p"
                description="We could not load your request history."
              />
            ) : requests.status === "failed" || requests.status === "commerce_unavailable" ? (
              <ShopStatusState
                layout="inline"
                variant="error"
                title="Could not load requests"
                titleAs="p"
                description="Try again later."
                actions={<ShopCatalogueStateRetryButton />}
              />
            ) : requests.status === "empty" ||
              (requests.status === "ok" && requests.data.length === 0) ? (
              <ShopStatusState
                layout="inline"
                variant="empty"
                title="No requests yet"
                titleAs="p"
                description="Submitted limit change requests will appear here."
              />
            ) : (
              <ul className="shop-account-list">
                {requests.data.map((row) => (
                  <li key={row.requestId} className="shop-account-list__row">
                    <p className="font-medium text-on-surface">{row.artworkTitle}</p>
                    <p className="text-on-surface-variant">
                      {row.requestedCount} requested ·{" "}
                      {formatPortalSaleAuthorityRequestStatus(row.status)} ·{" "}
                      {formatShopDate(row.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </ShopAccountShell>
  );
}
