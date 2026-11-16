import { ShopCheckoutSteps } from "@/components/checkout/shop-checkout-steps";
import { ShopCommercePageShell } from "@/components/shop-commerce-page-shell";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { MarketingDetailShell } from "@auction/marketing-ui";

/**
 * The loading state is drawn in the same frame as the page it gives way to: the real header and
 * steps (static, no data), then a form panel and a summary panel that reserve the room the
 * details page takes, so the footer and everything below do not move when the page arrives.
 */
export default function CheckoutLoading() {
  return (
    <MarketingDetailShell shellClassName="shop-page shop-page--checkout">
      <ShopCommercePageShell
        header={shopPageWayfinding.checkout}
        contentClassName="shop-checkout shop-checkout--details"
      >
        <ShopCheckoutSteps current="Details" />
        <div
          className="shop-checkout__layout shop-checkout__layout--with-bar shop-checkout-skeleton"
          aria-busy="true"
          aria-live="polite"
        >
          <span className="lax-skeleton shop-skeleton__bar shop-checkout-skeleton__disclosure" />
          <div className="shop-skeleton__commerce-panel shop-checkout-skeleton__form">
            <span className="lax-skeleton shop-skeleton__bar shop-skeleton__bar--title" />
            <span className="lax-skeleton shop-skeleton__bar shop-skeleton__bar--section" />
            <span className="lax-skeleton shop-skeleton__bar shop-skeleton__bar--section" />
            <span className="lax-skeleton shop-skeleton__bar shop-skeleton__bar--section" />
          </div>
          <div className="shop-skeleton__commerce-panel shop-checkout-skeleton__summary">
            <span className="lax-skeleton shop-skeleton__bar shop-skeleton__bar--section" />
            <span className="lax-skeleton shop-skeleton__bar shop-skeleton__bar--section" />
            <span className="lax-skeleton shop-skeleton__bar shop-skeleton__bar--action" />
          </div>
        </div>
      </ShopCommercePageShell>
    </MarketingDetailShell>
  );
}
