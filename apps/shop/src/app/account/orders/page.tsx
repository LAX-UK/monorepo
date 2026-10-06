import { ShopAccountShell } from "@/components/account/shop-account-shell";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { formatShopDateTime } from "@/lib/presenters/shop-date.presenter";
import { resolveShopOrderStatusPresentation } from "@/lib/presenters/shop-status-presentation";
import { listShopOrders } from "@/lib/shop-commerce.server";
import { resolveShopPortalOwnershipEnabled } from "@/lib/shop-portal.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { isShopPayoutsEnabled } from "@/lib/shop-runtime-flags";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageTitle("Orders");

export default async function AccountOrdersPage() {
  const viewer = await loadShopViewerState();
  const portalOwnershipEnabled = await resolveShopPortalOwnershipEnabled();
  const payoutsEnabled = isShopPayoutsEnabled();
  const shellNav = {
    activeNavHref: "/account/orders",
    portalOwnershipEnabled,
    payoutsEnabled,
  };

  const gate = gateShopAuthenticatedRoute(viewer, "/account/orders");
  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    return (
      <ShopAccountShell
        title={shopPageWayfinding.orders.title}
        breadcrumbs={shopPageWayfinding.orders.breadcrumbs}
        {...shellNav}
      >
        <ShopStatusState
          layout="page"
          variant="error"
          title="Orders unavailable"
          titleAs="h2"
          description={
            viewer.kind === "unavailable"
              ? viewer.message
              : "We could not verify your session. Try again shortly."
          }
          actions={<ShopCatalogueStateRetryButton />}
        />
      </ShopAccountShell>
    );
  }

  const ordersResult = await listShopOrders();

  return (
    <ShopAccountShell
      title={shopPageWayfinding.orders.title}
      breadcrumbs={shopPageWayfinding.orders.breadcrumbs}
      {...shellNav}
    >
      {ordersResult.status === "unauthorized" ? (
        <ShopStatusState
          layout="page"
          variant="error"
          title="Sign in again"
          titleAs="h2"
          description="Your session ended before we could load your orders."
          actions={
            <ShopStatusStateLink
              href={shopStorefrontLoginHref("/account/orders")}
              priority="primary"
            >
              Sign in
            </ShopStatusStateLink>
          }
        />
      ) : ordersResult.status === "failed" ? (
        <ShopStatusState
          layout="page"
          variant="error"
          title="Orders temporarily unavailable"
          titleAs="h2"
          description="We could not load your order history. Try again in a moment."
          actions={<ShopCatalogueStateRetryButton />}
        />
      ) : ordersResult.status === "empty" ? (
        <ShopStatusState
          layout="page"
          variant="empty"
          title="No orders yet"
          titleAs="h2"
          description="When you purchase an artwork, order details and progress will appear here."
          actions={
            <ShopStatusStateLink href="/artworks" priority="primary">
              Explore artworks
            </ShopStatusStateLink>
          }
        />
      ) : (
        <ul className="shop-orders__list">
          {ordersResult.data.map((order) => {
            const status = resolveShopOrderStatusPresentation(order.status);
            const firstLine = order.lines[0];
            const titleLine = firstLine?.artworkTitle ?? "Order";
            return (
              <li key={order.orderId} className="shop-orders__list-item">
                <Link href={`/account/orders/${order.orderId}`} className="shop-orders__list-link">
                  <span className="shop-orders__list-copy">
                    <span>
                      Order {order.orderId.slice(0, 8)}… · {titleLine}
                    </span>
                    <span className="shop-orders__status-hint">
                      {formatShopDateTime(order.createdAt)}
                    </span>
                  </span>
                  <span className="shop-orders__list-status">
                    <DotStatusPill label={status.label} tone={status.tone} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </ShopAccountShell>
  );
}
