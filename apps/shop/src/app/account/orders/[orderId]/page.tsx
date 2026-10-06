import { ShopAccountShell } from "@/components/account/shop-account-shell";
import { ShopOrderSummary } from "@/components/commerce/shop-order-summary";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { fetchShopOrder } from "@/lib/shop-commerce.server";
import { resolveShopPortalOwnershipEnabled } from "@/lib/shop-portal.server";
import { shopPrivatePageMetadata } from "@/lib/shop-private-page-metadata";
import { isShopPayoutsEnabled } from "@/lib/shop-runtime-flags";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { notFound, redirect } from "next/navigation";

export const metadata = shopPrivatePageMetadata;

type OrderDetailPageProps = {
  params: Promise<{ orderId: string }>;
};

export default async function AccountOrderDetailPage({ params }: OrderDetailPageProps) {
  const { orderId } = await params;
  const orderShortLabel = `${orderId.slice(0, 8)}…`;
  const wayfinding = shopPageWayfinding.orderDetail(orderShortLabel);
  const portalOwnershipEnabled = await resolveShopPortalOwnershipEnabled();
  const payoutsEnabled = isShopPayoutsEnabled();
  const shellNav = {
    activeNavHref: "/account/orders",
    portalOwnershipEnabled,
    payoutsEnabled,
  };

  const viewer = await loadShopViewerState();
  const gate = gateShopAuthenticatedRoute(viewer, `/account/orders/${orderId}`);
  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    return (
      <ShopAccountShell title={wayfinding.title} breadcrumbs={wayfinding.breadcrumbs} {...shellNav}>
        <ShopStatusState
          layout="page"
          variant="error"
          title="Order unavailable"
          titleAs="h2"
          description="We could not verify your session."
          actions={<ShopCatalogueStateRetryButton />}
        />
      </ShopAccountShell>
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
      <ShopAccountShell title={wayfinding.title} breadcrumbs={wayfinding.breadcrumbs} {...shellNav}>
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
      </ShopAccountShell>
    );
  }

  const order = orderResult.data;

  return (
    <ShopAccountShell title={wayfinding.title} breadcrumbs={wayfinding.breadcrumbs} {...shellNav}>
      <ShopOrderSummary order={order} />
    </ShopAccountShell>
  );
}
