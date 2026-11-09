"use client";

import { acceptDeliveryQuote } from "@/app/actions/accept-delivery-quote.actions";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import type { ShopDeliveryQuoteVm } from "@/lib/account/shop-orders.vm";
import { useState, useTransition } from "react";

/**
 * The delivery quote on an unpaid order outside the UK. While the gallery is pricing it, the card
 * says so and until when the print is held. Once priced, it shows the delivery price (insurance
 * included), says duties are the buyer's, and offers one button: accept and pay.
 */
export function ShopDeliveryQuote({
  quote,
  headingLevel = "h2",
}: {
  quote: ShopDeliveryQuoteVm;
  headingLevel?: "h2" | "h3";
}) {
  const [pending, startTransition] = useTransition();
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = pending || redirecting;
  const Heading = headingLevel;
  const headingId = `delivery-quote-${quote.orderId}`;

  return (
    <section className="shop-finish-paying shop-finish-paying--quote" aria-labelledby={headingId}>
      <div className="shop-finish-paying__copy">
        <Heading id={headingId} className="shop-finish-paying__title">
          {quote.stage === "ready"
            ? `Your delivery quote for ${quote.place}`
            : `We are pricing your delivery to ${quote.place}`}
        </Heading>
        {quote.price ? (
          <dl className="shop-finish-paying__facts">
            <div>
              <dt>Delivery, insurance included</dt>
              <dd>{quote.price.deliveryLabel}</dd>
            </div>
            <div>
              <dt>Courier</dt>
              <dd>{quote.price.carrierLabel}</dd>
            </div>
            <div>
              <dt>Total with your print</dt>
              <dd>{quote.price.totalLabel}</dd>
            </div>
          </dl>
        ) : (
          <p className="shop-finish-paying__item">
            We will email you the price within one working day. Nothing has been charged.
          </p>
        )}
        {quote.price?.leadTimeNote ? (
          <p className="shop-finish-paying__time">{quote.price.leadTimeNote}</p>
        ) : null}
        <p className="shop-finish-paying__time">
          {quote.stage === "ready"
            ? `You pay any import duties and taxes charged in ${quote.place}; they are not in this price. `
            : null}
          Your print is held until <time dateTime={quote.heldUntil}>{quote.heldUntilLabel}</time>.
        </p>
        {quote.stage === "ready" && !quote.canPay ? (
          <p className="shop-finish-paying__time">
            We are not taking payment for deliveries outside the UK just yet. We will email you the
            moment we are.
          </p>
        ) : null}
        {error ? (
          <p className="shop-finish-paying__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      {quote.stage === "ready" && quote.canPay ? (
        <ShopCommerceButton
          type="button"
          className="shop-finish-paying__action"
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await acceptDeliveryQuote(quote.orderId);
              if (result.kind === "error") {
                setError(result.message);
                return;
              }
              setRedirecting(true);
              window.location.href = result.checkoutUrl;
            });
          }}
        >
          {redirecting
            ? "Opening secure payment…"
            : pending
              ? "Accepting the quote…"
              : "Accept and pay"}
        </ShopCommerceButton>
      ) : null}
    </section>
  );
}
