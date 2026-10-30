"use client";

import { OrderSummaryTotals } from "@/components/basket/basket-summary";
import { CheckoutTermsNotice } from "@/components/checkout/checkout-terms-notice";
import { presentBasketLine, presentBasketSummary } from "@/lib/basket/basket-view.vm";
import type { BasketView, ShopFulfilmentOption } from "@auction/shop-contracts";
import { formatGbpPence } from "@auction/shop-portal/vm";
import { cn } from "@auction/ui";
import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useId, useState } from "react";

type Props = {
  basket: BasketView;
  fulfilment: ShopFulfilmentOption;
  showTermsNotice: boolean;
  /** The pay button and anything that belongs with it, so the total sits beside it. */
  action: ReactNode;
};

/** What is being bought: one row per line with its picture, artist and price. */
function CheckoutSummaryLines({ basket }: { basket: BasketView }) {
  return (
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
  );
}

/**
 * Phones only: the order at the top of checkout, closed by default and showing the total, so the
 * shopper sees what they are paying for before the form. Wider screens keep the side panel.
 */
export function CheckoutSummaryDisclosure({
  basket,
  fulfilment,
}: {
  basket: BasketView;
  fulfilment: ShopFulfilmentOption;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const summary = presentBasketSummary(basket.lines, fulfilment);
  return (
    <section
      className={cn("shop-checkout-disclosure", open && "is-open")}
      aria-label="Order summary"
    >
      <button
        type="button"
        className="shop-checkout-disclosure__toggle shop-focus-ring"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="shop-checkout-disclosure__label">
          {open ? "Hide order summary" : "Show order summary"}
          <svg
            className="shop-checkout-disclosure__chevron"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
        <span className="shop-checkout-disclosure__total">{summary.total}</span>
      </button>
      <div id={panelId} className="shop-checkout-disclosure__panel" hidden={!open}>
        <CheckoutSummaryLines basket={basket} />
        <OrderSummaryTotals summary={summary} />
      </div>
    </section>
  );
}

/**
 * What is being bought and what it costs, beside the form on wide screens and after it on
 * phones. The totals come from the basket's own calculation for the chosen delivery, so the
 * basket and checkout always agree. On phones the lines move to the disclosure at the top.
 */
export function CheckoutOrderSummary({ basket, fulfilment, showTermsNotice, action }: Props) {
  const summary = presentBasketSummary(basket.lines, fulfilment);
  return (
    <aside aria-labelledby="checkout-summary-heading" className="shop-basket__summary-panel">
      <h2 id="checkout-summary-heading" className="shop-basket__summary-title">
        Order summary
      </h2>
      <div className="shop-checkout__summary-side-lines">
        <CheckoutSummaryLines basket={basket} />
      </div>
      <OrderSummaryTotals summary={summary} />
      {showTermsNotice ? <CheckoutTermsNotice /> : null}
      {action}
      <Link href="/basket" className="shop-inline-link shop-focus-ring shop-checkout__back">
        Back to basket
      </Link>
    </aside>
  );
}
