import { MarketingCatalogHubShell } from "@/components/marketing/marketing-catalog-hub-shell";
import { MarketingCatalogToolbarSkeleton } from "@/components/marketing/marketing-catalog-toolbar-skeleton";
import { MarketingListSkeleton } from "@/components/marketing/marketing-list-skeleton";
import { readSkeletonView } from "@/lib/preferences/skeleton-view.server";

export default async function ArchiveLoading() {
  const view = await readSkeletonView("archive", "grid");

  return (
    <MarketingCatalogHubShell
      aria-busy="true"
      aria-label="Loading archive"
      hero={
        <div className="animate-pulse space-y-4">
          <div className="h-14 w-2/3 max-w-md rounded bg-surface-container-high" />
          <div className="h-4 w-48 rounded bg-surface-container-high" />
        </div>
      }
      toolbar={<MarketingCatalogToolbarSkeleton showActiveChips />}
      footer={
        <div className="flex animate-pulse justify-center gap-4">
          <div className="h-10 w-24 rounded bg-surface-container-high" />
          <div className="h-10 w-24 rounded bg-surface-container-high" />
        </div>
      }
    >
      <MarketingListSkeleton view={view} className="gap-x-12 gap-y-16" />
    </MarketingCatalogHubShell>
  );
}
