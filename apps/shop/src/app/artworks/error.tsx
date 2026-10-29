"use client";

import { CatalogueRouteError } from "@/components/catalogue-route-error";

export default function ArtworksError({ reset }: { reset: () => void }) {
  return (
    <CatalogueRouteError
      title="Editions are unavailable right now"
      reset={reset}
      browseHref="/help"
      browseLabel="Help and contact"
    />
  );
}
