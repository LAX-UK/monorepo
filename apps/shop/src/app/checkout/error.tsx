"use client";

import { ShopCommerceRouteError } from "@/components/shop-commerce-route-error";

export default function CheckoutError({ reset }: { reset: () => void }) {
  return (
    <ShopCommerceRouteError
      title="Checkout unavailable"
      reset={reset}
      backHref="/basket"
      backLabel="Back to basket"
    />
  );
}
