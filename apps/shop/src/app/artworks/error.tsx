"use client";

import { CatalogueRouteError } from "@/components/catalogue-route-error";

export default function ArtworksError({ reset }: { reset: () => void }) {
  return <CatalogueRouteError title="We could not load the editions" reset={reset} />;
}
