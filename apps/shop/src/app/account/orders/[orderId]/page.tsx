import { ShopAccountShell } from "@/components/account/shop-account-shell";
import { ShopOrderDetail } from "@/components/account/shop-order-detail";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { SHOP_ORDERS_HREF, shopOrderHref } from "@/lib/account/shop-account-routes";
import { buildShopOrderDetailVm } from "@/lib/account/shop-orders.vm";
import { fetchShopOrder } from "@/lib/shop-commerce.server";
import { shopPrivatePageMetadata } from "@/lib/shop-private-page-metadata";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { notFound, redirect } from "next/navigation";

export const metadata = shopPrivatePageMetadata;

type OrderDetailPageProps = {
  params: Promise<{ orderId: string }>;
};

const fallback = shopPageWayfinding.orderDetail("Order");

export default async function AccountOrderDetailPage({ params }: OrderDetailPageProps) {
  const { orderId } = await params;
  const returnTo = shopOrderHref(orderId);

  const viewer = await loadShopViewerState();
  const gate = gateShopAuthenticatedRoute(viewer, returnTo);
  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    return (
      <ShopAccountShell
        title={fallback.title}
        breadcrumbs={fallback.breadcrumbs}
        showAccountSettings={false}
      >
        <ShopStatusState
          layout="page"
          variant="error"
          title="Order unavailable"
          titleAs="h2"
          description="We could not verify your session. Try again shortly."
          actions={<ShopCatalogueStateRetryButton />}
        />
      </ShopAccountShell>
    );
  }

  const orderResult = await fetchShopOrder(orderId);
  if (orderResult.status === "unauthorized") redirect(shopStorefrontLoginHref(returnTo));
  if (orderResult.status === "empty") notFound();

  if (orderResult.status === "failed") {
    return (
      <ShopAccountShell
        title={fallback.title}
        breadcrumbs={fallback.breadcrumbs}
        showAccountSettings={false}
      >
        <ShopStatusState
          layout="page"
          variant="error"
          title="Order temporarily unavailable"
          titleAs="h2"
          description="We could not load this order. Try again in a moment."
          actions={
            <>
              <ShopCatalogueStateRetryButton />
              <ShopStatusStateLink href={SHOP_ORDERS_HREF}>Back to your orders</ShopStatusStateLink>
            </>
          }
        />
      </ShopAccountShell>
    );
  }

  const order = buildShopOrderDetailVm(orderResult.data);
  const wayfinding = shopPageWayfinding.orderDetail(order.title);

  return (
    <ShopAccountShell
      title={wayfinding.title}
      breadcrumbs={wayfinding.breadcrumbs}
      showAccountSettings={false}
    >
      <ShopOrderDetail order={order} />
    </ShopAccountShell>
  );
}
