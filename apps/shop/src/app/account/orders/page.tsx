import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { ShopCommercePageShell } from "@/components/shop-commerce-page-shell";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { formatGbpPence } from "@/lib/presenters/shop-money.presenter";
import { resolveShopOrderStatusPresentation } from "@/lib/presenters/shop-status-presentation";
import { listShopOrders } from "@/lib/shop-commerce.server";
import { shopPrivatePageMetadata } from "@/lib/shop-private-page-metadata";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { MarketingDetailShell } from "@auction/marketing-ui";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const metadata = shopPrivatePageMetadata;

function OrdersRouteShell({ children }: { children: ReactNode }) {
  return (
    <MarketingDetailShell shellClassName="shop-page shop-page--orders">
      <ShopCommercePageShell header={shopPageWayfinding.orders} contentClassName="shop-orders">
        {children}
      </ShopCommercePageShell>
    </MarketingDetailShell>
  );
}

export default async function AccountOrdersPage() {
  const viewer = await loadShopViewerState();
  const gate = gateShopAuthenticatedRoute(viewer, "/account/orders");
  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    return (
      <OrdersRouteShell>
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
      </OrdersRouteShell>
    );
  }

  const ordersResult = await listShopOrders();

  return (
    <OrdersRouteShell>
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
          actions={
            <>
              <ShopCatalogueStateRetryButton />
              <ShopStatusStateLink href="/account">Back to account</ShopStatusStateLink>
            </>
          }
        />
      ) : ordersResult.status === "empty" ? (
        <ShopStatusState
          layout="page"
          variant="empty"
          title="No orders yet"
          titleAs="h2"
          description="When you purchase an artwork, order details and progress will appear here."
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
          <ul className="shop-orders__list">
            {ordersResult.data.map((order) => {
              const status = resolveShopOrderStatusPresentation(order.status);
              return (
                <li key={order.orderId} className="shop-orders__list-item">
                  <Link
                    href={`/account/orders/${order.orderId}`}
                    className="shop-orders__list-link"
                  >
                    <span className="shop-orders__list-copy">
                      <span>
                        Order {order.orderId.slice(0, 8)}… · {formatGbpPence(order.totalPence)}
                      </span>
                      {status.hint ? (
                        <span className="shop-orders__status-hint">{status.hint}</span>
                      ) : null}
                    </span>
                    <span className="shop-orders__list-status">
                      <DotStatusPill label={status.label} tone={status.tone} />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          <Link href="/account" className="shop-detail__cta shop-focus-ring">
            Back to account
          </Link>
        </>
      )}
    </OrdersRouteShell>
  );
}
