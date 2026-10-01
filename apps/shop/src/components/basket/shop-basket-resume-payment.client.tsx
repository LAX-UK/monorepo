"use client";

import { resumeCheckoutPayment } from "@/app/actions/resume-checkout.actions";
import { formatGbpPence } from "@/lib/presenters/shop-money.presenter";
import type { OrderSummary } from "@auction/shop-contracts";
import { useState, useTransition } from "react";

type Props = {
  order: OrderSummary;
};

export function ShopBasketResumePayment({ order }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <output className="shop-basket__alert" aria-live="polite">
      <div className="flex flex-col gap-2">
        <p>
          You have a checkout in progress ({formatGbpPence(order.totalPence)}). Resume secure
          payment or cancel from Stripe to change your basket.
        </p>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button
          type="button"
          className="shop-detail__cta shop-focus-ring w-fit"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await resumeCheckoutPayment(order.orderId);
              if (result.kind === "error") {
                setError(result.message);
                return;
              }
              window.location.href = result.checkoutUrl;
            });
          }}
        >
          {pending ? "Opening payment…" : "Resume payment"}
        </button>
      </div>
    </output>
  );
}
