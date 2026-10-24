import { ShopAccountShell } from "@/components/account/shop-account-shell";
import { ShopOrderList } from "@/components/account/shop-order-list";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { SHOP_ORDERS_HREF } from "@/lib/account/shop-account-routes";
import { buildShopOrderListVm } from "@/lib/account/shop-orders.vm";
import { listShopOrders } from "@/lib/shop-commerce.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageTitle("Your orders");

const { title, breadcrumbs } = shopPageWayfinding.orders;

export default async function AccountOrdersPage() {
  const viewer = await loadShopViewerState();
  const gate = gateShopAuthenticatedRoute(viewer, SHOP_ORDERS_HREF);
  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    return (
      <ShopAccountShell title={title} breadcrumbs={breadcrumbs}>
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
  const list =
    ordersResult.status === "ok"
      ? buildShopOrderListVm(ordersResult.data)
      : ordersResult.status === "empty"
        ? ({ kind: "empty" } as const)
        : null;

  return (
    <ShopAccountShell title={title} breadcrumbs={breadcrumbs}>
      {ordersResult.status === "unauthorized" ? (
        <ShopStatusState
          layout="page"
          variant="error"
          title="Sign in again"
          titleAs="h2"
          description="Your session ended before we could load your orders."
          actions={
            <ShopStatusStateLink
              href={shopStorefrontLoginHref(SHOP_ORDERS_HREF)}
              priority="primary"
            >
              Sign in
            </ShopStatusStateLink>
          }
        />
      ) : list === null ? (
        <ShopStatusState
          layout="page"
          variant="error"
          title="Orders temporarily unavailable"
          titleAs="h2"
          description="We could not load your orders. Try again in a moment."
          actions={<ShopCatalogueStateRetryButton />}
        />
      ) : list.kind === "empty" ? (
        <ShopStatusState
          layout="page"
          variant="empty"
          icon="bag"
          title="No orders yet"
          titleAs="h2"
          description="When you buy an edition, the order and its progress appear here."
          actions={
            <ShopStatusStateLink href="/artworks" priority="primary">
              Browse editions
            </ShopStatusStateLink>
          }
        />
      ) : (
        <ShopOrderList rows={list.rows} />
      )}
    </ShopAccountShell>
  );
}
