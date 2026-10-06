import { BasketLinesClient } from "@/components/basket/basket-lines.client";
import { ShopBasketCancelNotice } from "@/components/basket/shop-basket-cancel-notice.client";
import { ShopBasketResumePayment } from "@/components/basket/shop-basket-resume-payment.client";
import { ShopCheckoutSteps } from "@/components/checkout/shop-checkout-steps";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { ShopAuthLink } from "@/components/shop-auth-link";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { ShopCommercePageShell } from "@/components/shop-commerce-page-shell";
import { ShopNotice } from "@/components/shop-notice";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import {
  basketCheckoutBlockMessage,
  basketCheckoutBlockReasons,
  canProceedToCheckout,
} from "@/lib/basket-checkout-eligibility";
import { formatGbpPence } from "@/lib/presenters/shop-money.presenter";
import { fetchShopBasket, listShopOrders } from "@/lib/shop-commerce.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { MarketingDetailShell } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import { Suspense } from "react";

export const metadata = shopPrivatePageTitle("Basket");

export default async function BasketPage() {
  const viewer = await loadShopViewerState();
  const ordersPromise =
    viewer.kind === "authenticated"
      ? listShopOrders()
      : Promise.resolve({ status: "empty" as const });
  const [basketResult, ordersResult] = await Promise.all([fetchShopBasket(), ordersPromise]);
  const pendingCheckoutOrder =
    ordersResult.status === "ok"
      ? (ordersResult.data.find((order) => order.status === "pending_payment") ?? null)
      : null;

  const checkoutEligible =
    basketResult.status === "ok" &&
    canProceedToCheckout(basketResult.data) &&
    !pendingCheckoutOrder;

  const summaryPanel =
    basketResult.status === "ok" && basketResult.data.lines.length > 0 ? (
      <>
        <p className="shop-basket__total">
          Subtotal <strong>{formatGbpPence(basketResult.data.merchandiseSubtotalPence)}</strong>
        </p>
        {checkoutEligible ? (
          viewer.kind === "authenticated" ? (
            <ShopCommerceButton href="/checkout" className="w-full">
              Proceed to checkout
            </ShopCommerceButton>
          ) : (
            <Button asChild variant="cta" size="md" className={cn("shop-focus-ring", "w-full")}>
              <ShopAuthLink href={shopStorefrontLoginHref("/checkout")}>
                Sign in to check out
              </ShopAuthLink>
            </Button>
          )
        ) : !pendingCheckoutOrder ? (
          <ShopNotice tone="info">Update your basket before proceeding to checkout.</ShopNotice>
        ) : null}
      </>
    ) : null;

  return (
    <MarketingDetailShell shellClassName="shop-page shop-page--basket">
      <ShopCommercePageShell header={shopPageWayfinding.basket} contentClassName="shop-basket">
        <ShopCheckoutSteps current="Basket" />
        <Suspense fallback={null}>
          <ShopBasketCancelNotice />
        </Suspense>
        {pendingCheckoutOrder ? <ShopBasketResumePayment order={pendingCheckoutOrder} /> : null}
        {basketResult.status === "unauthorized" ? (
          <ShopStatusState
            variant="error"
            icon="bag"
            layout="page"
            title="Sign in again"
            titleAs="h2"
            description="Your session ended before we could load your basket."
            actions={
              <ShopStatusStateLink href={shopStorefrontLoginHref("/basket")} priority="primary">
                Sign in
              </ShopStatusStateLink>
            }
          />
        ) : basketResult.status === "failed" ? (
          <ShopStatusState
            variant="error"
            icon="bag"
            layout="page"
            title="Basket temporarily unavailable"
            titleAs="h2"
            description="We could not load your basket. Try again or continue browsing the catalogue."
            actions={
              <>
                <ShopCatalogueStateRetryButton />
                <ShopStatusStateLink href="/artworks" priority="secondary">
                  Browse artworks
                </ShopStatusStateLink>
              </>
            }
          />
        ) : basketResult.status === "empty" ||
          (basketResult.status === "ok" && basketResult.data.lines.length === 0) ? (
          <ShopStatusState
            variant="empty"
            icon="bag"
            layout="page"
            title="Your basket is empty"
            titleAs="h2"
            description="Discover original works and limited editions, then add your favourites here."
            actions={
              <ShopStatusStateLink href="/artworks" priority="primary">
                Browse artworks
              </ShopStatusStateLink>
            }
          />
        ) : basketResult.status === "ok" ? (
          <>
            {!canProceedToCheckout(basketResult.data) ? (
              <ShopNotice tone="warning" title="Basket needs attention">
                {basketCheckoutBlockMessage(basketCheckoutBlockReasons(basketResult.data))}
              </ShopNotice>
            ) : null}
            <BasketLinesClient basket={basketResult.data} summary={summaryPanel} />
          </>
        ) : null}
      </ShopCommercePageShell>
    </MarketingDetailShell>
  );
}
