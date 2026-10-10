import { CheckoutForm } from "@/components/checkout/checkout-form";
import { ShopCheckoutSteps } from "@/components/checkout/shop-checkout-steps";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { ShopCommercePageShell } from "@/components/shop-commerce-page-shell";
import { shopPageWayfinding } from "@/components/shop-page-header";
import {
  ShopStatusState,
  ShopStatusStateAction,
  ShopStatusStateLink,
} from "@/components/shop-status-state";
import {
  basketCheckoutBlockMessage,
  basketCheckoutBlockReasons,
  canProceedToCheckout,
} from "@/lib/basket-checkout-eligibility";
import { fetchShopBasket } from "@/lib/shop-commerce.server";
import { shopIdentityUrl } from "@/lib/shop-identity.server";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { MarketingDetailShell } from "@auction/marketing-ui";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageTitle("Checkout");

type CheckoutPageProps = {
  searchParams: Promise<{ basketMerge?: string }>;
};

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const params = await searchParams;
  const [basketResult, viewer] = await Promise.all([fetchShopBasket(), loadShopViewerState()]);

  if (viewer.kind === "authenticated" && basketResult.status === "unauthorized") {
    redirect(shopStorefrontLoginHref("/checkout"));
  }

  const gate = gateShopAuthenticatedRoute(viewer, "/checkout");
  if (!gate.allowed) {
    if (viewer.kind === "guest" && params.basketMerge) {
      redirect(shopStorefrontLoginHref("/checkout"));
    }
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

  if (viewer.kind === "authenticated" && viewer.emailVerified === false) {
    return (
      <MarketingDetailShell shellClassName="shop-page shop-page--checkout">
        <ShopCommercePageShell
          header={shopPageWayfinding.checkout}
          contentClassName="shop-checkout"
        >
          <ShopStatusState
            layout="page"
            variant="error"
            title="Verify your email to check out"
            titleAs="h2"
            description={`Confirm ${viewer.email || "your email address"} so your order confirmation, receipt and delivery updates reach you. Your basket is saved.`}
            actions={
              <>
                <ShopStatusStateAction priority="primary" asChild>
                  <a href={shopIdentityUrl("/auth/verify-email")} className="shop-focus-ring">
                    Send verification email
                  </a>
                </ShopStatusStateAction>
                <ShopStatusStateAction asChild>
                  <a
                    href={shopIdentityUrl("/auth/upgrade?returnTo=%2Fcheckout")}
                    className="shop-focus-ring"
                  >
                    I’ve verified it
                  </a>
                </ShopStatusStateAction>
              </>
            }
          />
        </ShopCommercePageShell>
      </MarketingDetailShell>
    );
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
        <ShopCheckoutSteps current="Details" />
        <CheckoutForm
          basket={basket}
          {...(viewer.kind === "authenticated" && viewer.email
            ? {
                customerEmail: viewer.email,
                ...(viewer.verifiedPhone ? { defaultDeliveryPhone: viewer.verifiedPhone } : {}),
              }
            : {})}
        />
        <ShopCommerceButton href="/basket" variant="outline" className="mt-4">
          Back to basket
        </ShopCommerceButton>
      </ShopCommercePageShell>
    </MarketingDetailShell>
  );
}
