"use client";

import { ShopCommerceButton, ShopCommerceOutlineLink } from "@/components/shop-commerce-button";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  active: boolean;
  orderId?: string;
};

/** Refreshes confirmation while payment processes; offers manual refresh after 30s. */
export function CheckoutConfirmationPoller({ active, orderId }: Props) {
  const router = useRouter();
  const [pollingEnded, setPollingEnded] = useState(false);

  useEffect(() => {
    if (!active) {
      return;
    }
    const interval = setInterval(() => {
      router.refresh();
    }, 3_000);
    const stop = setTimeout(() => {
      clearInterval(interval);
      setPollingEnded(true);
    }, 30_000);
    return () => {
      clearInterval(interval);
      clearTimeout(stop);
    };
  }, [active, router]);

  if (!active) {
    return null;
  }

  return (
    <div className="shop-checkout__processing-status">
      <output className="shop-basket__alert" aria-live="polite">
        {pollingEnded
          ? "Payment is still processing. Check again, open your order, or browse order history."
          : "Payment is processing. This page updates automatically."}
      </output>
      {pollingEnded ? (
        <div className="flex flex-wrap gap-3">
          <ShopCommerceButton type="button" onClick={() => router.refresh()}>
            Check payment status
          </ShopCommerceButton>
          {orderId ? (
            <ShopCommerceOutlineLink href={`/account/orders/${orderId}`}>
              View order
            </ShopCommerceOutlineLink>
          ) : null}
          <ShopCommerceOutlineLink href="/account/orders">Order history</ShopCommerceOutlineLink>
        </div>
      ) : null}
    </div>
  );
}
