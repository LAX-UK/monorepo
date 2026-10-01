"use client";

import { resolveShopFulfilmentLabel } from "@/lib/presenters/shop-fulfilment.presenter";
import { formatGbpPence } from "@/lib/presenters/shop-money.presenter";
import type { ShopFulfilmentOption } from "@/lib/shop-fulfilment";
import type { BasketView } from "@auction/shop-contracts";
import { computeOrderTotal, fulfilmentSurchargePence, pence } from "@auction/shop-domain";

type Props = {
  basket: BasketView;
  fulfilment: ShopFulfilmentOption;
};

export function CheckoutBasketSummary({ basket, fulfilment }: Props) {
  const merchandiseSubtotal = basket.merchandiseSubtotalPence;
  const surcharge = fulfilmentSurchargePence(fulfilment);
  const total =
    fulfilment === "international_quotation"
      ? merchandiseSubtotal
      : computeOrderTotal({
          merchandiseSubtotalPence: pence(merchandiseSubtotal),
          fulfilment,
        });

  return (
    <section className="shop-checkout__summary" aria-labelledby="checkout-summary-heading">
      <h2 id="checkout-summary-heading" className="shop-checkout__summary-title">
        Order summary
      </h2>
      <ul className="shop-checkout__summary-lines">
        {basket.lines.map((line) => (
          <li key={line.lineId} className="shop-checkout__summary-line">
            <span>
              {line.artworkTitle}
              {line.quantity > 1 ? ` × ${line.quantity}` : ""}
            </span>
            <span>{formatGbpPence(line.unitPricePence * line.quantity)}</span>
          </li>
        ))}
      </ul>
      <dl className="shop-checkout__summary-totals">
        <div>
          <dt>Subtotal</dt>
          <dd>{formatGbpPence(merchandiseSubtotal)}</dd>
        </div>
        {fulfilment !== "international_quotation" ? (
          <div>
            <dt>{resolveShopFulfilmentLabel(fulfilment)}</dt>
            <dd>{formatGbpPence(surcharge)}</dd>
          </div>
        ) : null}
        <div className="shop-checkout__summary-total">
          <dt>Total</dt>
          <dd>{formatGbpPence(total)}</dd>
        </div>
      </dl>
    </section>
  );
}
