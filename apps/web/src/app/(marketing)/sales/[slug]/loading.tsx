import { MarketingCatalogToolbarSkeleton } from "@/components/marketing/marketing-catalog-toolbar-skeleton";
import { MarketingListSkeleton } from "@/components/marketing/marketing-list-skeleton";
import { MARKETING_CATALOG_PT, MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { readSkeletonView } from "@/lib/preferences/skeleton-view.server";
import { cn } from "@auction/ui";

const pulse = "animate-pulse rounded bg-surface-container-high";

export default async function SaleroomLoading() {
  const view = await readSkeletonView("sales-lot", "grid");
  return (
    <main
      id="main-content"
      className={cn(
        "bg-page-bg pb-[var(--page-bottom-padding)] dark:bg-background lg:pb-24",
        MARKETING_CATALOG_PT,
      )}
      aria-busy="true"
      aria-label="Loading sale"
    >
      <div className={cn(pulse, "h-12 w-full bg-surface-container-high lg:hidden")} aria-hidden />

      <div className={cn(pulse, "aspect-[16/9] w-full min-h-[min(60vh,520px)] bg-brand-900/40")} />

      <section className={cn(MARKETING_PAGE_SHELL, "pt-14")}>
        <MarketingCatalogToolbarSkeleton showActiveChips />
        <div className="mt-8">
          <MarketingListSkeleton
            view={view}
            count={8}
            className="gap-7 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          />
        </div>
      </section>
    </main>
  );
}
