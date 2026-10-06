"use client";

import { cancelCheckoutOrderFormAction } from "@/app/actions/cancel-checkout.actions";
import { useEffect, useRef, useState } from "react";

type Props = {
  orderId: string;
};

/** Submits the cancel form once when JS is available (progressive enhancement). */
export function ShopCheckoutCancelEnhancer({ orderId }: Props) {
  const submitted = useRef(false);
  const [cancelling, setCancelling] = useState(true);

  useEffect(() => {
    if (submitted.current) {
      return;
    }
    submitted.current = true;
    const formData = new FormData();
    formData.set("orderId", orderId);
    void cancelCheckoutOrderFormAction(formData).finally(() => {
      setCancelling(false);
    });
  }, [orderId]);

  return (
    <output className="shop-basket__alert" aria-live="polite">
      {cancelling ? "Cancelling checkout and releasing your reservation…" : null}
    </output>
  );
}
