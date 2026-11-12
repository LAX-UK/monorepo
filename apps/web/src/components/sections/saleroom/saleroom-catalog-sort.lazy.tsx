"use client";

import { useDeferredModule } from "@/hooks/use-deferred-module";

const loadSort = () =>
  import("@/components/sections/saleroom/saleroom-catalog-sort").then(
    (module) => module.SaleroomCatalogSort,
  );

/**
 * The sort select and its list library are fetched once the page has hydrated, not with its first
 * scripts. Until then (as before hydration) the current choice is shown as plain text of the same
 * size. Once fetched, it is drawn at once on later visits within the session. If the fetch failed,
 * pointing at or pressing the text fetches it again.
 */
export function LazySaleroomCatalogSort({ sortLabel }: { sortLabel: string }) {
  const loaded = useDeferredModule(loadSort, true);
  if (loaded.status === "ready") return <loaded.value />;
  const retryIfFailed = () => {
    if (loaded.status === "failed") loaded.retry();
  };
  return (
    <span
      className="inline-flex h-10 min-h-10 items-center rounded-md border border-outline-variant/40 bg-surface-container-lowest px-3 font-label text-xs font-medium text-on-surface-variant"
      aria-label={`Sort: ${sortLabel}`}
      onPointerEnter={retryIfFailed}
      onPointerDown={retryIfFailed}
    >
      {sortLabel}
    </span>
  );
}
