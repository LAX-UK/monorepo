"use client";

import { CatalogueRouteError } from "@/components/catalogue-route-error";

export default function CategoriesError({ reset }: { reset: () => void }) {
  return <CatalogueRouteError title="Categories temporarily unavailable" reset={reset} />;
}
