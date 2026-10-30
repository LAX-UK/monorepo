import { ShopOrderLines, ShopOrderTotals } from "@/components/account/shop-order-lines";
import { CheckoutConfirmationPoller } from "@/components/checkout/checkout-confirmation-poller.client";
import { GuestAccountOffer } from "@/components/checkout/guest-account-offer";
import { ShopCheckoutSteps } from "@/components/checkout/shop-checkout-steps";
import { ShopOrderConfirmation } from "@/components/checkout/shop-order-confirmation";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { ShopCommerceButton, ShopCommerceOutlineLink } from "@/components/shop-commerce-button";
import { ShopCommercePageShell } from "@/components/shop-commerce-page-shell";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { shopOrderHref } from "@/lib/account/shop-account-routes";
import {
  buildShopOrderLines,
  buildShopOrderTotals,
  shopOrderName,
} from "@/lib/account/shop-orders.vm";
import { resolveCheckoutConfirmationView } from "@/lib/checkout-confirmation-state";
import { loadCheckoutDeliveryTimes } from "@/lib/checkout/checkout-delivery.server";
import { fetchCurrentGuestOrder } from "@/lib/checkout/guest-order.server";
import { GUEST_ORDER_INVOICE_PATH, GUEST_ORDER_PATH } from "@/lib/checkout/guest-order.vm";
import { buildOrderConfirmationVm } from "@/lib/checkout/order-confirmation.vm";
import { fetchShopOrder } from "@/lib/shop-commerce.server";
import { shopPrivatePageMetadata } from "@/lib/shop-private-page-metadata";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { MarketingDetailShell } from "@auction/marketing-ui";
import type { OrderSummary } from "@auction/shop-contracts";
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
        <ShopCheckoutSteps current="Confirmation" />
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
  if (viewer.kind === "guest" && orderId) {
    // A guest's browser holds the order's access token from checkout.
    const guest = await fetchCurrentGuestOrder();
    if (
      guest.status === "ok" &&
      guest.view.state === "valid" &&
      guest.view.order.orderId === orderId
    ) {
      return <GuestConfirmation order={guest.view.order} email={guest.view.email} />;
    }
  }
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

  if (view.order.status === "paid") {
    const confirmation = buildOrderConfirmationVm({
      order: view.order,
      displayName: viewer.kind === "authenticated" ? viewer.displayName : null,
      email: viewer.kind === "authenticated" ? viewer.email : null,
      times: loadCheckoutDeliveryTimes(),
    });
    return (
      <ConfirmationRouteShell title={confirmation.heading}>
        <ShopOrderConfirmation confirmation={confirmation} />
      </ConfirmationRouteShell>
    );
  }

  const order = view.order;
  return (
    <ConfirmationRouteShell title={view.heading}>
      <CheckoutConfirmationPoller
        active={order.status === "pending_payment"}
        orderId={order.orderId}
      />
      {view.statusMessage ? <output className="block">{view.statusMessage}</output> : null}
      {order.status === "payment_failed" ? (
        <ShopCommerceButton href="/basket">Return to basket</ShopCommerceButton>
      ) : null}
      <section className="shop-order-panel" aria-labelledby="confirmation-order-heading">
        <h2 id="confirmation-order-heading" className="shop-order-panel__title">
          {shopOrderName(order)}
        </h2>
        <ShopOrderLines lines={buildShopOrderLines(order)} />
        <ShopOrderTotals totals={buildShopOrderTotals(order)} />
      </section>
      <div className="flex flex-wrap gap-3">
        <ShopCommerceOutlineLink href={shopOrderHref(order.orderId)}>
          View order
        </ShopCommerceOutlineLink>
        <ShopCommerceOutlineLink href="/account/orders">Your orders</ShopCommerceOutlineLink>
      </div>
    </ConfirmationRouteShell>
  );
}

/** The confirmation a guest sees: the same order, with its guest links and the account offer. */
function GuestConfirmation({ order, email }: { order: OrderSummary; email: string }) {
  if (order.status === "paid") {
    const confirmation = buildOrderConfirmationVm({
      order,
      displayName: null,
      email,
      times: loadCheckoutDeliveryTimes(),
      links: { orderHref: GUEST_ORDER_PATH, invoiceHref: GUEST_ORDER_INVOICE_PATH },
    });
    return (
      <ConfirmationRouteShell title={confirmation.heading}>
        <ShopOrderConfirmation confirmation={confirmation} />
        <GuestAccountOffer email={email} headingId="confirmation-account-heading" />
      </ConfirmationRouteShell>
    );
  }
  const view = resolveCheckoutConfirmationView({
    orderId: order.orderId,
    orderResult: { status: "ok", data: order },
  });
  const heading = view.kind === "order" ? view.heading : shopPageWayfinding.confirmation.title;
  const statusMessage = view.kind === "order" ? view.statusMessage : null;
  return (
    <ConfirmationRouteShell title={heading}>
      <CheckoutConfirmationPoller
        active={order.status === "pending_payment"}
        orderId={order.orderId}
        guestOrderHref={GUEST_ORDER_PATH}
      />
      {statusMessage ? <output className="block">{statusMessage}</output> : null}
      {order.status === "payment_failed" ? (
        <ShopCommerceButton href="/basket">Return to basket</ShopCommerceButton>
      ) : null}
      <section className="shop-order-panel" aria-labelledby="confirmation-order-heading">
        <h2 id="confirmation-order-heading" className="shop-order-panel__title">
          {shopOrderName(order)}
        </h2>
        <ShopOrderLines lines={buildShopOrderLines(order)} />
        <ShopOrderTotals totals={buildShopOrderTotals(order)} />
      </section>
      <div className="flex flex-wrap gap-3">
        <ShopCommerceOutlineLink href={GUEST_ORDER_PATH}>View order</ShopCommerceOutlineLink>
      </div>
    </ConfirmationRouteShell>
  );
}
