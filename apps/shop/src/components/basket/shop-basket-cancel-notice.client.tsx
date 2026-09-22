"use client";

import { abandonCheckout } from "@/app/actions/cancel-checkout.actions";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

export function ShopBasketCancelNotice() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const cancelHandled = useRef(false);

  const cancelled = searchParams.get("cancelled") === "1";
  const orderId = searchParams.get("orderId");

  useEffect(() => {
    if (!cancelled || !orderId || cancelHandled.current) {
      return;
    }
    cancelHandled.current = true;
    void abandonCheckout(orderId);
  }, [cancelled, orderId]);

  if (!cancelled) {
    return null;
  }

  function dismiss() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("cancelled");
    params.delete("orderId");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <output className="shop-basket__alert" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p>
          Checkout was cancelled. Reserved prints were released — review your basket and try again
          when you are ready.
        </p>
        <button type="button" className="shop-focus-ring text-sm underline" onClick={dismiss}>
          Dismiss
        </button>
      </div>
    </output>
  );
}
