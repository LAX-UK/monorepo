import { cancelCheckoutOrderFormAction } from "@/app/actions/cancel-checkout.actions";
import { ShopCheckoutCancelEnhancer } from "@/components/checkout/shop-checkout-cancel-enhancer.client";
import { ShopCatalogueStateRetryButton } from "@/components/home/shop-catalogue-state-retry.client";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { ShopCommercePageShell } from "@/components/shop-commerce-page-shell";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { shopPrivatePageTitle } from "@/lib/shop-private-page-metadata";
import { gateShopAuthenticatedRoute, shopStorefrontLoginHref } from "@/lib/shop-viewer-state";
import { loadShopViewerState } from "@/lib/shop-viewer-state.server";
import { MarketingDetailShell } from "@auction/marketing-ui";
import { redirect } from "next/navigation";

export const metadata = shopPrivatePageTitle("Checkout cancelled");

type CancelCheckoutPageProps = {
  searchParams: Promise<{ orderId?: string; error?: string }>;
};

export default async function CancelCheckoutPage({ searchParams }: CancelCheckoutPageProps) {
  const params = await searchParams;
  const orderId = params.orderId?.trim() ?? "";
  const errorMessage = params.error?.trim() ?? null;
  const returnTo = orderId
    ? `/checkout/cancel?orderId=${encodeURIComponent(orderId)}`
    : "/checkout/cancel";

  const viewer = await loadShopViewerState();
  const gate = gateShopAuthenticatedRoute(viewer, returnTo);
  if (!gate.allowed) {
    if (gate.redirectTo) redirect(gate.redirectTo);
    return (
      <MarketingDetailShell shellClassName="shop-page shop-page--checkout-cancel">
        <ShopCommercePageShell
          header={shopPageWayfinding.checkout}
          contentClassName="shop-checkout"
        >
          <ShopStatusState
            layout="page"
            variant="error"
            title="Sign-in required"
            titleAs="h2"
            description={
              viewer.kind === "unavailable"
                ? viewer.message
                : "Sign in to cancel checkout for your account."
            }
            actions={<ShopCatalogueStateRetryButton />}
          />
        </ShopCommercePageShell>
      </MarketingDetailShell>
    );
  }

  if (!orderId) {
    return (
      <MarketingDetailShell shellClassName="shop-page shop-page--checkout-cancel">
        <ShopCommercePageShell
          header={shopPageWayfinding.checkout}
          contentClassName="shop-checkout"
        >
          <ShopStatusState
            layout="page"
            variant="error"
            title="Checkout cancel link invalid"
            titleAs="h2"
            description="Return to your basket and start checkout again."
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
    <MarketingDetailShell shellClassName="shop-page shop-page--checkout-cancel">
      <ShopCommercePageShell
        header={shopPageWayfinding.checkoutCancel}
        contentClassName="shop-checkout"
      >
        <ShopCheckoutCancelEnhancer orderId={orderId} />
        <h2 className="shop-checkout__legend">Cancel secure payment</h2>
        <p className="shop-detail__notice">
          Release reserved prints and return to your basket. This works even when JavaScript is
          disabled.
        </p>
        {errorMessage ? (
          <ShopStatusState
            variant="error"
            layout="inline"
            icon="alert"
            title="Could not cancel checkout"
            description={errorMessage}
            announcement="assertive"
          />
        ) : null}
        <form action={cancelCheckoutOrderFormAction} className="shop-checkout__form">
          <input type="hidden" name="orderId" value={orderId} />
          <ShopCommerceButton type="submit">
            Release reservation and return to basket
          </ShopCommerceButton>
        </form>
        {viewer.kind !== "authenticated" ? (
          <p className="shop-detail__notice">
            <ShopStatusStateLink href={shopStorefrontLoginHref(returnTo)}>
              Sign in
            </ShopStatusStateLink>{" "}
            if checkout belongs to your account.
          </p>
        ) : null}
      </ShopCommercePageShell>
    </MarketingDetailShell>
  );
}
