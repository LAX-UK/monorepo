import { ShopOrderLines, ShopOrderTotals } from "@/components/account/shop-order-lines";
import { ShopCommerceButton, ShopCommerceOutlineLink } from "@/components/shop-commerce-button";
import type { OrderConfirmationVm } from "@/lib/checkout/order-confirmation.vm";

/**
 * A paid order's confirmation: proof (the reference and where the receipt went), what happens
 * next, the order itself, and the way to follow it.
 */
export function ShopOrderConfirmation({ confirmation }: { confirmation: OrderConfirmationVm }) {
  return (
    <div className="shop-confirmed">
      <div className="shop-confirmed__proof">
        <p className="shop-confirmed__label">Order reference</p>
        <p className="shop-confirmed__reference">{confirmation.reference}</p>
        <p className="shop-confirmed__text">Your order is confirmed. {confirmation.receiptLine}</p>
      </div>

      <section className="shop-confirmed__next" aria-labelledby="confirmed-next-heading">
        <h2 id="confirmed-next-heading" className="shop-confirmed__heading">
          What happens next
        </h2>
        <ol className="shop-confirmed__steps">
          {confirmation.nextSteps.map((step) => (
            <li key={step.title} className="shop-confirmed__step">
              <p className="shop-confirmed__step-title">{step.title}</p>
              <p className="shop-confirmed__step-text">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="shop-order-panel" aria-labelledby="confirmed-order-heading">
        <h2 id="confirmed-order-heading" className="shop-order-panel__title">
          Your order
        </h2>
        <ShopOrderLines lines={confirmation.lines} />
        <ShopOrderTotals totals={confirmation.totals} />
        <div className="shop-confirmed__delivery">
          <p className="shop-order-delivery__method">{confirmation.delivery.method}</p>
          {confirmation.delivery.lines.length > 0 ? (
            <address className="shop-order-delivery__address">
              {confirmation.delivery.lines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </address>
          ) : null}
        </div>
      </section>

      <div className="shop-confirmed__actions">
        <ShopCommerceButton href={confirmation.orderHref}>View your order</ShopCommerceButton>
        <ShopCommerceOutlineLink href="/artworks">Keep browsing</ShopCommerceOutlineLink>
        {confirmation.invoiceHref ? (
          <a
            href={confirmation.invoiceHref}
            download
            className="shop-inline-link shop-focus-ring shop-confirmed__invoice"
          >
            Download invoice (PDF)
          </a>
        ) : null}
      </div>
    </div>
  );
}
