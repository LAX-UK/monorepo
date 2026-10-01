"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  active: boolean;
};

/** Refreshes confirmation while payment processes; offers manual refresh after 30s. */
export function CheckoutConfirmationPoller({ active }: Props) {
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
          ? "Payment is still processing. You can check again or view order history below."
          : "Payment is processing. This page updates automatically."}
      </output>
      {pollingEnded ? (
        <button
          type="button"
          className="shop-detail__cta shop-focus-ring"
          onClick={() => router.refresh()}
        >
          Check payment status
        </button>
      ) : null}
    </div>
  );
}
