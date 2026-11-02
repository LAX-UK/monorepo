import { ViewItemListTracker } from "@/components/analytics/view-item-list-tracker";
import { ArchivePageToolbar } from "@/components/sections/archive/archive-page-toolbar";
import { ArchivePagination } from "@/components/sections/archive/archive-pagination";
import { CatalogArchiveView } from "@/components/sections/archive/catalog-archive-view";
import { PastAuctionsEmpty } from "@/components/sections/archive/past-auctions-grid";
import { archiveLotLinkParams } from "@/lib/marketing/catalog-links";
import type { ResultsLotsPage } from "@/lib/marketing/load-results-lots";
import { Suspense } from "react";

function ToolbarFallback() {
  return (
    <div className="mb-8 h-14 animate-pulse rounded-md bg-surface-container-high" aria-hidden />
  );
}

/** The sold-works search: count, filters and sort above the grid. */
export function ResultsLotsToolbar({ data, years }: { data: ResultsLotsPage; years: number[] }) {
  return (
    <Suspense fallback={<ToolbarFallback />}>
      <ArchivePageToolbar
        query={data.query}
        resultCount={data.totalCount}
        categories={data.categories}
        years={years}
      />
    </Suspense>
  );
}

export function ResultsLotsBody({ data }: { data: ResultsLotsPage }) {
  if (data.items.length === 0) {
    return <PastAuctionsEmpty hasActiveFilters={data.hasActiveFilters} />;
  }
  return (
    <>
      <ViewItemListTracker
        listId="results_lots"
        listName="Results lots"
        itemIds={data.items.map((item) => item.auction.id)}
      />
      <CatalogArchiveView
        view="grid"
        items={data.items}
        currentUserId={data.currentUserId}
        catalogLinkParams={archiveLotLinkParams("grid")}
      />
    </>
  );
}

export function ResultsLotsPagination({ data }: { data: ResultsLotsPage }) {
  return (
    <Suspense fallback={null}>
      <ArchivePagination page={data.query.page} totalPages={data.totalPages} />
    </Suspense>
  );
}
