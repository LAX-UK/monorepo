import { ShopCommercePageShell } from "@/components/shop-commerce-page-shell";
import { shopPageWayfinding } from "@/components/shop-page-header";
import { MarketingDetailShell } from "@auction/marketing-ui";

/**
 * The basket while it loads, in the basket's own frame: the real header (static, no data), then
 * the basket layout with one line (the work on its mat, its details and the quantity control) and
 * the order summary beside it on wide screens, below it on narrow ones. Each block is at the size
 * of what replaces it, so the footer and everything below do not move when the basket arrives.
 */
export default function BasketLoading() {
  return (
    <MarketingDetailShell shellClassName="shop-page shop-page--basket">
      <ShopCommercePageShell header={shopPageWayfinding.basket} contentClassName="shop-basket">
        <div className="shop-basket__layout" aria-busy="true" aria-live="polite">
          <div className="shop-basket__lines">
            <div className="shop-basket__line">
              <span className="lax-skeleton shop-skeleton__bar shop-basket__thumb" />
              <div className="shop-basket-skeleton__body">
                <span className="lax-skeleton shop-skeleton__bar shop-basket-skeleton__title" />
                <span className="lax-skeleton shop-skeleton__bar shop-basket-skeleton__text" />
                <span className="lax-skeleton shop-skeleton__bar shop-basket-skeleton__text" />
                <span className="lax-skeleton shop-skeleton__bar shop-basket-skeleton__quantity" />
              </div>
            </div>
          </div>
          <div className="shop-basket__summary-panel">
            <span className="lax-skeleton shop-skeleton__bar shop-basket-skeleton__title" />
            <span className="lax-skeleton shop-skeleton__bar shop-basket-skeleton__row" />
            <span className="lax-skeleton shop-skeleton__bar shop-basket-skeleton__row" />
            <span className="lax-skeleton shop-skeleton__bar shop-basket-skeleton__total" />
            <span className="lax-skeleton shop-skeleton__bar shop-basket-skeleton__note" />
            <span className="lax-skeleton shop-skeleton__bar shop-basket-skeleton__action" />
            <span className="lax-skeleton shop-skeleton__bar shop-basket-skeleton__note" />
            <span className="lax-skeleton shop-skeleton__bar shop-basket-skeleton__row" />
          </div>
        </div>
      </ShopCommercePageShell>
    </MarketingDetailShell>
  );
}
