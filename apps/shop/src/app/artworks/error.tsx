"use client";

import { CatalogueRouteError } from "@/components/catalogue-route-error";

export default function ArtworksError({ reset }: { reset: () => void }) {
  return <CatalogueRouteError title="Artworks temporarily unavailable" reset={reset} />;
}
