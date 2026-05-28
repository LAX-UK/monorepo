import { MarketingCatalogToolbarSkeleton } from "@/components/marketing/marketing-catalog-toolbar-skeleton";
import { MarketingListSkeleton } from "@/components/marketing/marketing-list-skeleton";
import { MARKETING_CATALOG_PT, MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { readSkeletonView } from "@/lib/preferences/skeleton-view.server";
import { cn } from "@auction/ui";

export default async function ArchiveLoading() {
  const view = await readSkeletonView("archive", "grid");

  return (
    <main
      id="main-content"
      className={cn(
        MARKETING_PAGE_SHELL,
        MARKETING_CATALOG_PT,
        "bg-surface pb-[var(--page-bottom-padding)] text-on-surface",
      )}
      aria-busy="true"
      aria-label="Loading archive"
    >
      <div className="animate-pulse space-y-8">
        <div className="space-y-4">
          <div className="h-14 w-2/3 max-w-md rounded bg-surface-container-high" />
          <div className="h-4 w-48 rounded bg-surface-container-high" />
        </div>

        <MarketingCatalogToolbarSkeleton showActiveChips />

        <MarketingListSkeleton view={view} className="gap-x-12 gap-y-16" />

        <div className="flex justify-center gap-4">
          <div className="h-10 w-24 rounded bg-surface-container-high" />
          <div className="h-10 w-24 rounded bg-surface-container-high" />
        </div>
      </div>
    </main>
  );
}
