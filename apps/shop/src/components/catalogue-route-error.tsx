"use client";

import { ShopRouteErrorState } from "@/components/shop-route-error-state";
import { ShopStatusStateAction, ShopStatusStateLink } from "@/components/shop-status-state-actions";

type CatalogueRouteErrorProps = {
  title?: string;
  reset: () => void;
  browseHref?: string;
  browseLabel?: string;
};

export function CatalogueRouteError({
  title = "Catalogue temporarily unavailable",
  reset,
  browseHref = "/artworks",
  browseLabel = "Browse artworks",
}: CatalogueRouteErrorProps) {
  return (
    <div className="shop-home-shell">
      <main id="main-content" className="shop-home">
        <ShopRouteErrorState
          title={title}
          description="We could not load this collection. Try again or continue browsing elsewhere in the shop."
          actions={
            <>
              <ShopStatusStateAction priority="primary" onClick={reset}>
                Try again
              </ShopStatusStateAction>
              <ShopStatusStateLink href={browseHref}>{browseLabel}</ShopStatusStateLink>
            </>
          }
        />
      </main>
    </div>
  );
}
