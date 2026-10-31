import { BasketLinesClient } from "@/components/basket/basket-lines.client";
import { ShopBasketCancelNotice } from "@/components/basket/shop-basket-cancel-notice.client";
import { ShopBasketResumePayment } from "@/components/basket/shop-basket-resume-payment.client";
import { CatalogueGrid } from "@/components/catalogue-grid";
import { ShopCheckoutSteps } from "@/components/checkout/shop-checkout-steps";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { ShopAuthLink } from "@/components/shop-auth-link";
import { ShopCommerceButton, shopButtonClassName } from "@/components/shop-commerce-button";
import { ShopCommercePageShell } from "@/components/shop-commerce-page-shell";
import { ShopNotice } from "@/components/shop-notice";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { SHOP_POLICY_PATHS } from "@/content/policies/shop-policy-status";
import {
  basketCheckoutBlockMessage,
  basketCheckoutBlockReasons,
  basketCheckoutEntry,
  canProceedToCheckout,
} from "@/lib/basket-checkout-eligibility";
import { loadLinkableShopPolicies } from "@/lib/policies/shop-policy-publication.server";
import { fetchPublicArtworks } from "@/lib/shop-api.server";
import { fetchShopBasket, listShopOrders } from "@/lib/shop-commerce.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { MarketingDetailShell } from "@auction/marketing-ui";
import type { BasketLine } from "@auction/shop-contracts";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { type ReactNode, Suspense } from "react";

export const metadata = shopPrivatePageTitle("Basket");

/** Four editions on sale now, for the empty basket; nothing when the catalogue cannot be read. */
async function loadSuggestedEditions() {
  try {
    const { items } = await fetchPublicArtworks({ limit: 4, availability: "available" });
    return items;
  } catch {
    return [];
  }
}

/** The summary's actions; the figures above them follow the lines on the client. */
function BasketSummaryActions({
  checkoutAction,
  blocked,
}: {
  checkoutAction: ReactNode;
  blocked: boolean;
}) {
  const linkable = loadLinkableShopPolicies();
  return (
    <>
      {blocked ? (
        <ShopNotice tone="info">Update your basket before checkout.</ShopNotice>
      ) : (
        checkoutAction
      )}
      <ul className="shop-basket__policies">
        {linkable.includes("delivery") ? (
          <li>
            <Link href={SHOP_POLICY_PATHS.delivery} className="shop-inline-link shop-focus-ring">
              Delivery and collection
            </Link>
          </li>
        ) : null}
        {linkable.includes("returns") ? (
          <li>
            <Link href={SHOP_POLICY_PATHS.returns} className="shop-inline-link shop-focus-ring">
              14-day cancellation
            </Link>
          </li>
        ) : null}
      </ul>
    </>
  );
}

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

  const lines: BasketLine[] = basketResult.status === "ok" ? basketResult.data.lines : [];
  const known = basketResult.status === "ok" || basketResult.status === "empty";
  const suggestions = known && lines.length === 0 ? await loadSuggestedEditions() : [];

  const checkoutAction =
    basketCheckoutEntry(viewer.kind) === "checkout" ? (
      <>
        <ShopCommerceButton href="/checkout" className="w-full">
          Checkout
        </ShopCommerceButton>
        {viewer.kind === "guest" ? (
          <p className="shop-basket__summary-note">
            Check out as a guest or sign in to your LAX Account at the next step.
          </p>
        ) : null}
      </>
    ) : (
      <>
        <Button
          asChild
          variant="cta"
          size="lg"
          className={shopButtonClassName("cta", "commerce", "w-full")}
        >
          <ShopAuthLink href={shopStorefrontLoginHref("/checkout")}>
            Sign in to check out
          </ShopAuthLink>
        </Button>
        <p className="shop-basket__summary-note">
          Sign in or create a LAX Account to pay. Your basket is kept and you come back to checkout.
        </p>
      </>
    );

  const summaryActions =
    basketResult.status === "ok" && lines.length > 0 ? (
      <BasketSummaryActions
        checkoutAction={pendingCheckoutOrder ? null : checkoutAction}
        blocked={!canProceedToCheckout(basketResult.data) && !pendingCheckoutOrder}
      />
    ) : null;

  const emptyState = (
    <div className="shop-basket__empty">
      <ShopStatusState
        variant="empty"
        icon="bag"
        layout="page"
        title="Your basket is empty"
        titleAs="h2"
        description="Find an edition you love, and it will wait for you here."
        actions={
          <ShopStatusStateLink href="/artworks" priority="primary">
            Browse editions
          </ShopStatusStateLink>
        }
      />
      {suggestions.length > 0 ? (
        <section aria-labelledby="basket-suggestions-heading" className="shop-basket__suggestions">
          <h2 id="basket-suggestions-heading" className="shop-basket__suggestions-title">
            On sale now
          </h2>
          <CatalogueGrid items={suggestions} titleLevel={3} />
        </section>
      ) : null}
    </div>
  );

  return (
    <MarketingDetailShell shellClassName="shop-page shop-page--basket">
      <ShopCommercePageShell header={shopPageWayfinding.basket} contentClassName="shop-basket">
        {/* The step bar belongs to a basket with something to check out. */}
        {lines.length > 0 ? <ShopCheckoutSteps current="Basket" /> : null}
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
                  Browse editions
                </ShopStatusStateLink>
              </>
            }
          />
        ) : (
          <>
            {basketResult.status === "ok" && !canProceedToCheckout(basketResult.data) ? (
              <ShopNotice tone="warning" title="Your basket needs attention">
                {basketCheckoutBlockMessage(basketCheckoutBlockReasons(basketResult.data))}
              </ShopNotice>
            ) : null}
            <BasketLinesClient
              lines={lines}
              summaryActions={summaryActions}
              emptyState={emptyState}
            />
          </>
        )}
      </ShopCommercePageShell>
    </MarketingDetailShell>
  );
}
