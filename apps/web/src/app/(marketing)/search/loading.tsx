import { MarketingListSkeleton } from "@/components/marketing/marketing-list-skeleton";
import { readSkeletonView } from "@/lib/preferences/skeleton-view.server";

export default async function SearchLoading() {
  const view = await readSkeletonView("search", "grid");

  return (
    <main
      id="main-content"
      className="mx-auto max-w-[var(--container-max,1440px)] bg-surface px-6 pb-24 pt-[var(--section-pt)] md:px-16"
      aria-busy="true"
      aria-label="Loading search"
    >
      <div className="animate-pulse space-y-10">
        <div className="space-y-3">
          <div className="h-10 w-48 rounded bg-surface-container-high" />
          <div className="h-4 w-full max-w-md rounded bg-surface-container-high" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="h-12 flex-1 rounded border-b-2 border-outline-variant/20 bg-surface-container-high/50" />
          <div className="h-12 w-full rounded bg-surface-container-high sm:w-32" />
        </div>
        <MarketingListSkeleton view={view} />
      </div>
    </main>
  );
}
