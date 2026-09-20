import { ShopOrderSummary } from "@/components/commerce/shop-order-summary";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { ShopCommercePageShell } from "@/components/shop-commerce-page-shell";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { resolveCheckoutConfirmationView } from "@/lib/checkout-confirmation-state";
import { fetchShopOrder } from "@/lib/shop-commerce.server";
import { shopPrivatePageMetadata } from "@/lib/shop-private-page-metadata";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { MarketingDetailShell } from "@auction/marketing-ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export const metadata = shopPrivatePageMetadata;

type ConfirmationPageProps = {
  searchParams: Promise<{ orderId?: string }>;
};

function ConfirmationRouteShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <MarketingDetailShell shellClassName="shop-page shop-page--confirmation">
      <ShopCommercePageShell
        header={{ title, breadcrumbs: shopPageWayfinding.confirmation.breadcrumbs }}
        contentClassName="shop-confirmation"
      >
        {children}
      </ShopCommercePageShell>
    </MarketingDetailShell>
  );
}

export default async function CheckoutConfirmationPage({ searchParams }: ConfirmationPageProps) {
  const params = await searchParams;
  const orderId = params.orderId;
  const returnTo = orderId
    ? `/checkout/confirmation?orderId=${encodeURIComponent(orderId)}`
    : "/checkout/confirmation";
  const viewer = await loadShopViewerState();
  const gate = gateShopAuthenticatedRoute(viewer, returnTo);
  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    return (
      <ConfirmationRouteShell title={shopPageWayfinding.confirmation.title}>
        <ShopStatusState
          layout="page"
          variant="error"
          title="Sign-in required"
          titleAs="h2"
          description={
            viewer.kind === "unavailable"
              ? viewer.message
              : "Sign in to view your order confirmation."
          }
          actions={<ShopCatalogueStateRetryButton />}
        />
      </ConfirmationRouteShell>
    );
  }

  const orderResult = orderId ? await fetchShopOrder(orderId) : { status: "empty" as const };
  const view = resolveCheckoutConfirmationView({ orderId, orderResult });

  if (view.kind === "missing_order_id") {
    return (
      <ConfirmationRouteShell title={shopPageWayfinding.confirmation.title}>
        <ShopStatusState
          layout="page"
          variant="empty"
          title="No order selected"
          titleAs="h2"
          description="Open an order from your history or complete checkout to see confirmation here."
          actions={
            <>
              <ShopStatusStateLink href="/account/orders" priority="primary">
                View orders
              </ShopStatusStateLink>
              <ShopStatusStateLink href="/artworks">Browse artworks</ShopStatusStateLink>
            </>
          }
        />
      </ConfirmationRouteShell>
    );
  }

  if (view.kind === "unauthorized") {
    return (
      <ConfirmationRouteShell title={shopPageWayfinding.confirmation.title}>
        <ShopStatusState
          layout="page"
          variant="error"
          title="Sign in again"
          titleAs="h2"
          description="Your session ended before we could load this order."
          actions={
            <ShopStatusStateLink href={shopStorefrontLoginHref(returnTo)} priority="primary">
              Sign in
            </ShopStatusStateLink>
          }
        />
      </ConfirmationRouteShell>
    );
  }

  if (view.kind === "load_failed") {
    return (
      <ConfirmationRouteShell title={shopPageWayfinding.confirmation.title}>
        <ShopStatusState
          layout="page"
          variant="error"
          title="Order unavailable"
          titleAs="h2"
          description="We could not load this order. Try again or check your order history."
          actions={
            <>
              <ShopCatalogueStateRetryButton />
              <ShopStatusStateLink href="/account/orders">View orders</ShopStatusStateLink>
            </>
          }
        />
      </ConfirmationRouteShell>
    );
  }

  if (view.kind === "not_found") {
    return (
      <ConfirmationRouteShell title={shopPageWayfinding.confirmation.title}>
        <ShopStatusState
          layout="page"
          variant="empty"
          title="Order not found"
          titleAs="h2"
          description="This order may belong to another account or has not been created yet."
          actions={
            <ShopStatusStateLink href="/account/orders" priority="primary">
              View orders
            </ShopStatusStateLink>
          }
        />
      </ConfirmationRouteShell>
    );
  }

  return (
    <ConfirmationRouteShell title={view.heading}>
      {view.statusMessage ? <output className="block">{view.statusMessage}</output> : null}
      {view.order.status === "payment_failed" ? (
        <ShopStatusStateLink href="/basket" priority="primary">
          Return to basket
        </ShopStatusStateLink>
      ) : null}
      <ShopOrderSummary order={view.order} heading={`Order ${view.order.orderId.slice(0, 8)}…`} />
      <Link
        href={`/account/orders/${view.order.orderId}`}
        className="shop-detail__cta shop-focus-ring"
      >
        View full order
      </Link>
      <Link href="/account/orders" className="shop-detail__cta shop-focus-ring">
        View order history
      </Link>
    </ConfirmationRouteShell>
  );
}
