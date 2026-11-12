"use client";

import { MarketingFilterTrigger } from "@/components/marketing/marketing-filter-trigger";
import type { SaleroomCatalogFilterSheetProps } from "@/components/sections/saleroom/saleroom-catalog-filter-sheet";
import { useDeferredModule } from "@/hooks/use-deferred-module";

const loadFilterSheet = () =>
  import("@/components/sections/saleroom/saleroom-catalog-filter-sheet").then(
    (module) => module.SaleroomCatalogFilterSheet,
  );

/**
 * The phone filter sheet and its drawer library are fetched once the page has hydrated, not with
 * its first scripts. Until then (as before hydration) the same trigger stands in for it.
 */
export function LazySaleroomCatalogFilterSheet(props: SaleroomCatalogFilterSheetProps) {
  const loaded = useDeferredModule(loadFilterSheet, true);
  if (loaded.status !== "ready") return <MarketingFilterTrigger activeCount={0} />;
  return <loaded.value {...props} />;
}
