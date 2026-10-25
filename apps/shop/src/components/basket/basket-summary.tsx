import { presentBasketSummary } from "@/lib/basket/basket-view.vm";
import type { BasketLine } from "@auction/shop-contracts";
import type { ReactNode } from "react";

/**
 * Subtotal, delivery and total, worked out from the lines as shown, so a quantity change and the
 * figures beside it always agree.
 */
export function BasketSummary({
  lines,
  actions,
}: {
  lines: ReadonlyArray<Pick<BasketLine, "unitPricePence" | "quantity">>;
  actions: ReactNode;
}) {
  const summary = presentBasketSummary(lines);
  return (
    <>
      <h2 id="basket-summary-heading" className="shop-basket__summary-title">
        Order summary
      </h2>
      <dl className="shop-basket__sums">
        <div className="shop-basket__sum">
          <dt>{summary.itemCountLabel}</dt>
          <dd>{summary.subtotal}</dd>
        </div>
        <div className="shop-basket__sum">
          <dt>{summary.deliveryLabel}</dt>
          <dd>{summary.delivery}</dd>
        </div>
        <div className="shop-basket__sum shop-basket__sum--total">
          <dt>Total</dt>
          <dd>{summary.total}</dd>
        </div>
      </dl>
      <p className="shop-basket__summary-note">
        {summary.vatNote}. {summary.deliveryNote}
      </p>
      {actions}
    </>
  );
}
