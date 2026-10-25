import { OrderSummaryTotals } from "@/components/basket/basket-summary";
import { CheckoutTermsNotice } from "@/components/checkout/checkout-terms-notice";
import { presentBasketLine, presentBasketSummary } from "@/lib/basket/basket-view.vm";
import type { BasketView, ShopFulfilmentOption } from "@auction/shop-contracts";
import { formatGbpPence } from "@auction/shop-portal/vm";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  basket: BasketView;
  fulfilment: ShopFulfilmentOption;
  showTermsNotice: boolean;
  /** The pay button and anything that belongs with it, so the total sits beside it. */
  action: ReactNode;
};

/**
 * What is being bought and what it costs, beside the form on wide screens and after it on
 * phones. The totals come from the basket's own calculation for the chosen delivery, so the
 * basket and checkout always agree.
 */
export function CheckoutOrderSummary({ basket, fulfilment, showTermsNotice, action }: Props) {
  const summary = presentBasketSummary(basket.lines, fulfilment);
  return (
    <aside aria-labelledby="checkout-summary-heading" className="shop-basket__summary-panel">
      <h2 id="checkout-summary-heading" className="shop-basket__summary-title">
        Order summary
      </h2>
      <ul className="shop-checkout__summary-lines">
        {basket.lines.map((line) => {
          const vm = presentBasketLine(line);
          return (
            <li key={vm.lineId} className="shop-checkout__summary-line">
              <div className="shop-checkout__summary-thumb" aria-hidden>
                {vm.imageUrl ? <Image src={vm.imageUrl} alt="" fill sizes="3.5rem" /> : null}
              </div>
              <div className="shop-checkout__summary-text">
                <p className="shop-checkout__summary-name">
                  {vm.title}
                  {vm.quantity > 1 ? <span> × {vm.quantity}</span> : null}
                </p>
                {vm.artistName ? (
                  <p className="shop-checkout__summary-meta">{vm.artistName}</p>
                ) : null}
                {vm.detail ? <p className="shop-checkout__summary-meta">{vm.detail}</p> : null}
              </div>
              <p className="shop-checkout__summary-price">
                {formatGbpPence(vm.unitPricePence * vm.quantity)}
              </p>
            </li>
          );
        })}
      </ul>
      <OrderSummaryTotals summary={summary} />
      {showTermsNotice ? <CheckoutTermsNotice /> : null}
      {action}
      <Link href="/basket" className="shop-inline-link shop-focus-ring shop-checkout__back">
        Back to basket
      </Link>
    </aside>
  );
}
