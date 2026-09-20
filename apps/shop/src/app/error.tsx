"use client";

import { ShopCommerceRouteError } from "@/components/shop-commerce-route-error";

export default function ShopRootError({ reset }: { reset: () => void }) {
  return (
    <ShopCommerceRouteError
      title="Shop temporarily unavailable"
      description="Something went wrong loading this page. Try again or return home."
      reset={reset}
    />
  );
}
