"use client";

import { useDeferredModule } from "@/hooks/use-deferred-module";

const loadSort = () =>
  import("@/components/sections/saleroom/saleroom-catalog-sort").then(
    (module) => module.SaleroomCatalogSort,
  );

/**
 * The sort select and its list library are fetched once the page has hydrated, not with its first
 * scripts. Until then (as before hydration) the current choice is shown as plain text of the same size.
 */
export function LazySaleroomCatalogSort({ sortLabel }: { sortLabel: string }) {
  const loaded = useDeferredModule(loadSort, true);
  if (loaded.status === "ready") return <loaded.value />;
  return (
    <span
      className="inline-flex h-10 min-h-10 items-center rounded-md border border-outline-variant/40 bg-surface-container-lowest px-3 font-label text-xs font-medium text-on-surface-variant"
      aria-label={`Sort: ${sortLabel}`}
    >
      {sortLabel}
    </span>
  );
}
