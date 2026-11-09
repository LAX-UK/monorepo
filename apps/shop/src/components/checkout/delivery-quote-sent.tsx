"use client";

import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { countryName, holdUntilLabel } from "@/lib/checkout/outside-uk";
import { useEffect, useRef } from "react";

type Props = {
  orderReference: string;
  country: string;
  /** An ISO moment: when the held print is released if the quote is not paid. */
  holdUntil: string;
};

/**
 * Shown once a delivery quote request is in: the print is held, nothing has been charged, and what
 * happens next. Focus moves to the heading so screen reader users hear it, since the form they
 * were in has gone.
 */
export function DeliveryQuoteSent({ orderReference, country, holdUntil }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const place = countryName(country);
  return (
    <section className="shop-checkout__sent" aria-labelledby="delivery-quote-sent-heading">
      <h2
        id="delivery-quote-sent-heading"
        ref={heading}
        tabIndex={-1}
        className="shop-checkout__sent-title"
      >
        We have your delivery quote request
      </h2>
      <p className="shop-checkout__sent-lead">
        Nothing has been charged. We will email you the price to deliver to {place} within one
        working day.
      </p>
      <dl className="shop-checkout__sent-facts">
        <div>
          <dt>Order</dt>
          <dd>{orderReference}</dd>
        </div>
        <div>
          <dt>Delivering to</dt>
          <dd>{place}</dd>
        </div>
        <div>
          <dt>Your print is held until</dt>
          <dd>{holdUntilLabel(holdUntil)}</dd>
        </div>
      </dl>
      <h2 className="shop-checkout__sent-subtitle">What happens next</h2>
      <ol className="shop-checkout__sent-steps">
        <li>We choose a courier and email you the price, with insurance included.</li>
        <li>You pay for the print and delivery together, from the link in our email.</li>
        <li>We make your print ready and send it. Import duties and taxes in {place} are yours.</li>
      </ol>
      <p className="shop-checkout__sent-note">
        If the quote is not paid by {holdUntilLabel(holdUntil)}, we release the print and you can
        ask again.
      </p>
      <ShopCommerceButton href="/" variant="outline" className="shop-checkout__sent-action">
        Continue shopping
      </ShopCommerceButton>
    </section>
  );
}
