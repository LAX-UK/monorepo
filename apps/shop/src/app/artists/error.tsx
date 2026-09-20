"use client";

import { CatalogueRouteError } from "@/components/catalogue-route-error";

export default function ArtistsError({ reset }: { reset: () => void }) {
  return <CatalogueRouteError title="Artists temporarily unavailable" reset={reset} />;
}
