import { MarketingListSkeleton } from "@/components/marketing/marketing-list-skeleton";
import { readSkeletonView } from "@/lib/preferences/skeleton-view.server";

export default async function SaleroomLoading() {
  const view = await readSkeletonView("sales-lot", "grid");
  return (
    <main
      id="main-content"
      className="mx-auto max-w-[var(--container-max,1440px)] bg-surface px-6 pb-24 pt-[var(--section-pt)] md:px-16"
      aria-busy="true"
      aria-label="Loading sale"
    >
      <div className="animate-pulse space-y-10">
        <div className="aspect-[16/7] w-full rounded bg-surface-container-high" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="h-8 w-2/3 rounded bg-surface-container-high" />
            <div className="h-4 w-full rounded bg-surface-container-high" />
            <div className="h-4 w-5/6 rounded bg-surface-container-high" />
          </div>
          <div className="space-y-3 rounded border border-border-hairline bg-surface-container-low/40 p-5">
            <div className="h-4 w-1/2 rounded bg-surface-container-high" />
            <div className="h-4 w-3/4 rounded bg-surface-container-high" />
            <div className="h-4 w-2/3 rounded bg-surface-container-high" />
          </div>
        </div>
        <MarketingListSkeleton
          view={view}
          count={8}
          className="gap-7 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        />
      </div>
    </main>
  );
}
