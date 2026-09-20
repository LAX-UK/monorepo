"use client";

import {
  ShopStatusState,
  ShopStatusStateAction,
  ShopStatusStateLink,
} from "@/components/shop-status-state";

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
        <ShopStatusState
          variant="error"
          title={title}
          titleAs="h1"
          description="We could not load this collection. Try again or continue browsing elsewhere in the shop."
          className="shop-status-state--page"
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
