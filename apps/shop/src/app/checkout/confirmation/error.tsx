"use client";

import { ShopCommerceRouteError } from "@/components/shop-commerce-route-error";

export default function ConfirmationError({ reset }: { reset: () => void }) {
  return (
    <ShopCommerceRouteError
      title="Confirmation unavailable"
      reset={reset}
      backHref="/account/orders"
      backLabel="View orders"
    />
  );
}
