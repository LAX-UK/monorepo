"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Props = {
  lotTitle?: string;
};

type PaymentReturnState = "success" | "cancelled";

/** Stripe return URLs (`?payment=success|cancelled`) — refresh fulfilment after success. */
export function CheckoutReturnBanner({ lotTitle }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const stripped = useRef(false);
  const [paymentState, setPaymentState] = useState<PaymentReturnState | null>(null);
  const lotLabel = lotTitle?.trim() || "your lot";

  useEffect(() => {
    const payment = searchParams.get("payment");
    if (payment !== "success" && payment !== "cancelled") return;

    if (!stripped.current) {
      stripped.current = true;
      setPaymentState(payment);
      const next = new URLSearchParams(searchParams.toString());
      next.delete("payment");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }

    if (payment === "success") {
      router.refresh();
    }
  }, [pathname, router, searchParams]);

  if (paymentState === "success") {
    return (
      <output
        className="mb-6 block rounded-lg border border-primary/30 bg-primary-container/20 px-4 py-3 font-body text-sm text-on-surface"
        aria-live="polite"
      >
        <p className="font-medium text-on-surface">Returned from Stripe</p>
        <p className="mt-1 text-on-surface-variant">
          Thanks — we&apos;re finishing up {lotLabel}. See the status below for what happens next.
        </p>
      </output>
    );
  }

  if (paymentState === "cancelled") {
    return (
      <output
        className="mb-6 block rounded-lg border border-warning/40 bg-warning-container/15 px-4 py-3 font-body text-sm text-on-surface"
        aria-live="polite"
      >
        <p className="font-medium text-on-surface">Payment not completed</p>
        <p className="mt-1 text-on-surface-variant">
          You left Stripe checkout without paying for {lotLabel}. You can try again below when
          ready.
        </p>
      </output>
    );
  }

  return null;
}
