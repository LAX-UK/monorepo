"use client";

import { cancelCheckoutOrderFormAction } from "@/app/actions/cancel-checkout.actions";
import { useEffect, useRef } from "react";

type Props = {
  orderId: string;
};

/** Submits the cancel form once when JS is available (progressive enhancement). */
export function ShopCheckoutCancelEnhancer({ orderId }: Props) {
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current) {
      return;
    }
    submitted.current = true;
    const formData = new FormData();
    formData.set("orderId", orderId);
    void cancelCheckoutOrderFormAction(formData);
  }, [orderId]);

  return null;
}
