import { BasketLinesClient } from "@/components/basket/basket-lines.client";
import { ShopBasketCancelNotice } from "@/components/basket/shop-basket-cancel-notice.client";
import { ShopBasketResumePayment } from "@/components/basket/shop-basket-resume-payment.client";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { ShopAuthLink } from "@/components/shop-auth-link";
import { ShopCommercePageShell } from "@/components/shop-commerce-page-shell";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import {
  basketCheckoutBlockMessage,
  basketCheckoutBlockReasons,
  canProceedToCheckout,
} from "@/lib/basket-checkout-eligibility";
import { fetchShopBasket, listShopOrders } from "@/lib/shop-commerce.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { MarketingDetailShell } from "@auction/marketing-ui";
import Link from "next/link";
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

  return (
    <MarketingDetailShell shellClassName="shop-page shop-page--basket">
      <ShopCommercePageShell header={shopPageWayfinding.basket} contentClassName="shop-basket">
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
              <p className="shop-basket__alert" role="alert">
                {basketCheckoutBlockMessage(basketCheckoutBlockReasons(basketResult.data))}
              </p>
            ) : null}
            <BasketLinesClient basket={basketResult.data} />
            {canProceedToCheckout(basketResult.data) ? (
              viewer.kind === "authenticated" ? (
                <Link
                  href="/checkout"
                  prefetch={false}
                  className="shop-detail__cta shop-focus-ring"
                >
                  Proceed to checkout
                </Link>
              ) : (
                <ShopAuthLink
                  href={shopStorefrontLoginHref("/checkout")}
                  className="shop-detail__cta shop-focus-ring"
                >
                  Sign in to check out
                </ShopAuthLink>
              )
            ) : (
              <p className="shop-detail__notice">
                Update your basket before proceeding to checkout.
              </p>
            )}
          </>
        ) : null}
      </ShopCommercePageShell>
    </MarketingDetailShell>
  );
}
