"use client";

import { resumeCheckoutPayment } from "@/app/actions/resume-checkout.actions";
import { ShopOrderThumbnail } from "@/components/account/shop-order-thumbnail";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import type { ShopFinishPayingVm } from "@/lib/account/shop-orders.vm";
import { useState, useTransition } from "react";

/**
 * An unpaid checkout whose editions are still reserved: one card with the way back to secure
 * payment. It goes once the reservation runs out, because the order can no longer be paid.
 */
export function ShopFinishPaying({
  order,
  headingLevel = "h2",
}: {
  order: ShopFinishPayingVm;
  headingLevel?: "h2" | "h3";
}) {
  const [pending, startTransition] = useTransition();
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = pending || redirecting;
  const Heading = headingLevel;

  return (
    <section className="shop-finish-paying" aria-labelledby={`finish-paying-${order.orderId}`}>
      <ShopOrderThumbnail src={order.thumbnailUrl} size={64} />
      <div className="shop-finish-paying__copy">
        <Heading id={`finish-paying-${order.orderId}`} className="shop-finish-paying__title">
          Your payment is not finished
        </Heading>
        <p className="shop-finish-paying__item">
          {order.title} · {order.totalLabel}
        </p>
        <p className="shop-finish-paying__time">
          <time dateTime={order.expiresAt}>{order.reservedLabel}</time>
        </p>
        {error ? (
          <p className="shop-finish-paying__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <ShopCommerceButton
        type="button"
        className="shop-finish-paying__action"
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await resumeCheckoutPayment(order.orderId);
            if (result.kind === "error") {
              setError(result.message);
              return;
            }
            setRedirecting(true);
            window.location.href = result.checkoutUrl;
          });
        }}
      >
        {redirecting ? "Opening secure payment…" : pending ? "Opening payment…" : "Finish paying"}
      </ShopCommerceButton>
    </section>
  );
}
