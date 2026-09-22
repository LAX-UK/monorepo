"use client";

import { ShopCommerceRouteError } from "@/components/shop-commerce-route-error";

export default function BasketError({ reset }: { reset: () => void }) {
  return (
    <ShopCommerceRouteError
      title="Basket unavailable"
      reset={reset}
      backHref="/artworks"
      backLabel="Browse artworks"
    />
  );
}
