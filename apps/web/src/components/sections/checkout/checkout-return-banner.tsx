"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** Stripe return URLs (`?payment=success|cancelled`) — refresh fulfilment after success. */
export function CheckoutReturnBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const payment = searchParams.get("payment");

  useEffect(() => {
    if (payment !== "success") return;
    router.refresh();
  }, [payment, router]);

  if (payment === "success") {
    return (
      <output className="mb-6 block rounded-lg border border-primary/30 bg-primary-container/20 px-4 py-3 font-body text-sm text-on-surface">
        <p className="font-medium text-on-surface">Returned from Stripe</p>
        <p className="mt-1 text-on-surface-variant">
          Thank you — payment confirmation may take a moment. This page will update when your lot
          status changes.
        </p>
      </output>
    );
  }

  if (payment === "cancelled") {
    return (
      <output className="mb-6 block rounded-lg border border-warning/40 bg-warning-container/15 px-4 py-3 font-body text-sm text-on-surface">
        <p className="font-medium text-on-surface">Payment not completed</p>
        <p className="mt-1 text-on-surface-variant">
          You left Stripe checkout without paying. You can try again below when ready.
        </p>
      </output>
    );
  }

  return null;
}
