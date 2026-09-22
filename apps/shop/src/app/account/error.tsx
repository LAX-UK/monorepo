"use client";

import { ShopCommerceRouteError } from "@/components/shop-commerce-route-error";

export default function AccountError({ reset }: { reset: () => void }) {
  return (
    <ShopCommerceRouteError
      title="Account unavailable"
      reset={reset}
      backHref="/"
      backLabel="Return home"
    />
  );
}
