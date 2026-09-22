import { CheckoutForm } from "@/components/checkout/checkout-form";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { ShopCommercePageShell } from "@/components/shop-commerce-page-shell";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import {
  basketCheckoutBlockMessage,
  basketCheckoutBlockReasons,
  canProceedToCheckout,
} from "@/lib/basket-checkout-eligibility";
import { fetchShopBasket } from "@/lib/shop-commerce.server";
import { shopPrivatePageMetadata } from "@/lib/shop-private-page-metadata";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { MarketingDetailShell } from "@auction/marketing-ui";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageMetadata;

export default async function CheckoutPage() {
  const [basketResult, viewer] = await Promise.all([fetchShopBasket(), loadShopViewerState()]);

  const gate = gateShopAuthenticatedRoute(viewer, "/checkout");
  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    return (
      <MarketingDetailShell shellClassName="shop-page shop-page--checkout">
        <ShopCommercePageShell
          header={shopPageWayfinding.checkout}
          contentClassName="shop-checkout"
        >
          <ShopStatusState
            layout="page"
            variant="error"
            title="Sign-in status unavailable"
            titleAs="h2"
            description={
              viewer.kind === "unavailable"
                ? viewer.message
                : "We could not verify your session. Try again shortly."
            }
            actions={<ShopCatalogueStateRetryButton />}
          />
        </ShopCommercePageShell>
      </MarketingDetailShell>
    );
  }

  if (basketResult.status === "unauthorized") {
    return (
      <MarketingDetailShell shellClassName="shop-page shop-page--checkout">
        <ShopCommercePageShell
          header={shopPageWayfinding.checkout}
          contentClassName="shop-checkout"
        >
          <ShopStatusState
            layout="page"
            variant="error"
            title="Sign in again"
            titleAs="h2"
            description="Your session ended before we could load checkout."
            actions={
              <ShopStatusStateLink href={shopStorefrontLoginHref("/checkout")} priority="primary">
                Sign in
              </ShopStatusStateLink>
            }
          />
        </ShopCommercePageShell>
      </MarketingDetailShell>
    );
  }

  if (basketResult.status === "failed") {
    return (
      <MarketingDetailShell shellClassName="shop-page shop-page--checkout">
        <ShopCommercePageShell
          header={shopPageWayfinding.checkout}
          contentClassName="shop-checkout"
        >
          <ShopStatusState
            layout="page"
            variant="error"
            title="Checkout unavailable"
            titleAs="h2"
            description="We could not load your basket. Return to the basket and try again."
            actions={
              <>
                <ShopCatalogueStateRetryButton />
                <ShopStatusStateLink href="/basket">Back to basket</ShopStatusStateLink>
              </>
            }
          />
        </ShopCommercePageShell>
      </MarketingDetailShell>
    );
  }

  if (basketResult.status !== "ok") {
    redirect("/basket");
  }

  const basket = basketResult.data;

  if (basket.lines.length === 0) {
    redirect("/basket");
  }

  if (!canProceedToCheckout(basket)) {
    return (
      <MarketingDetailShell shellClassName="shop-page shop-page--checkout">
        <ShopCommercePageShell
          header={shopPageWayfinding.checkout}
          contentClassName="shop-checkout"
        >
          <ShopStatusState
            layout="page"
            variant="error"
            title="Basket needs attention"
            titleAs="h2"
            description={basketCheckoutBlockMessage(basketCheckoutBlockReasons(basket))}
            actions={
              <ShopStatusStateLink href="/basket" priority="primary">
                Back to basket
              </ShopStatusStateLink>
            }
          />
        </ShopCommercePageShell>
      </MarketingDetailShell>
    );
  }

  return (
    <MarketingDetailShell shellClassName="shop-page shop-page--checkout">
      <ShopCommercePageShell header={shopPageWayfinding.checkout} contentClassName="shop-checkout">
        <CheckoutForm basketId={basket.basketId} />
        <Link href="/basket" className="shop-detail__cta shop-focus-ring">
          Back to basket
        </Link>
      </ShopCommercePageShell>
    </MarketingDetailShell>
  );
}
