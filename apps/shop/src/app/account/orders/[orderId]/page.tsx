import { ShopOrderSummary } from "@/components/commerce/shop-order-summary";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { ShopCommercePageShell } from "@/components/shop-commerce-page-shell";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { fetchShopOrder } from "@/lib/shop-commerce.server";
import { shopPrivatePageMetadata } from "@/lib/shop-private-page-metadata";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { MarketingDetailShell } from "@auction/marketing-ui";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

export const metadata = shopPrivatePageMetadata;

type OrderDetailPageProps = {
  params: Promise<{ orderId: string }>;
};

function OrderDetailRouteShell({
  orderShortLabel,
  children,
}: {
  orderShortLabel: string;
  children: ReactNode;
}) {
  const wayfinding = shopPageWayfinding.orderDetail(orderShortLabel);
  return (
    <MarketingDetailShell shellClassName="shop-page shop-page--orders">
      <ShopCommercePageShell header={wayfinding} contentClassName="shop-orders">
        {children}
      </ShopCommercePageShell>
    </MarketingDetailShell>
  );
}

export default async function AccountOrderDetailPage({ params }: OrderDetailPageProps) {
  const { orderId } = await params;
  const orderShortLabel = `${orderId.slice(0, 8)}…`;
  const viewer = await loadShopViewerState();
  const gate = gateShopAuthenticatedRoute(viewer, `/account/orders/${orderId}`);
  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    return (
      <OrderDetailRouteShell orderShortLabel={orderShortLabel}>
        <ShopStatusState
          layout="page"
          variant="error"
          title="Order unavailable"
          titleAs="h2"
          description="We could not verify your session."
          actions={<ShopCatalogueStateRetryButton />}
        />
      </OrderDetailRouteShell>
    );
  }

  const orderResult = await fetchShopOrder(orderId);
  if (orderResult.status === "unauthorized") {
    redirect(shopStorefrontLoginHref(`/account/orders/${orderId}`));
  }
  if (orderResult.status === "empty") {
    notFound();
  }
  if (orderResult.status === "failed") {
    return (
      <OrderDetailRouteShell orderShortLabel={orderShortLabel}>
        <ShopStatusState
          layout="page"
          variant="error"
          title="Order temporarily unavailable"
          titleAs="h2"
          description="Try again in a moment."
          actions={
            <>
              <ShopCatalogueStateRetryButton />
              <ShopStatusStateLink href="/account/orders">Back to orders</ShopStatusStateLink>
            </>
          }
        />
      </OrderDetailRouteShell>
    );
  }

  const order = orderResult.data;

  return (
    <OrderDetailRouteShell orderShortLabel={orderShortLabel}>
      <ShopOrderSummary order={order} />
      <Link href="/account/orders" className="shop-detail__cta shop-focus-ring">
        Back to orders
      </Link>
    </OrderDetailRouteShell>
  );
}
