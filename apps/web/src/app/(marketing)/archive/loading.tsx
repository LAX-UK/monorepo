import { MarketingListSkeleton } from "@/components/marketing/marketing-list-skeleton";
import { readSkeletonView } from "@/lib/preferences/skeleton-view.server";

export default async function ArchiveLoading() {
  const view = await readSkeletonView("archive", "grid");

  return (
    <main
      id="main-content"
      className="bg-surface px-8 pb-24 pt-[var(--section-pt)] text-on-surface md:px-20"
      aria-busy="true"
      aria-label="Loading archive"
    >
      <div className="mx-auto max-w-screen-2xl animate-pulse space-y-12">
        <div className="space-y-4">
          <div className="h-14 w-2/3 max-w-md rounded bg-surface-container-high" />
          <div className="h-4 w-48 rounded bg-surface-container-high" />
        </div>
        <div className="h-24 rounded-md bg-surface-container-high" />
        <MarketingListSkeleton view={view} className="gap-x-12 gap-y-16" />
        <div className="flex justify-center gap-4">
          <div className="h-10 w-24 rounded bg-surface-container-high" />
          <div className="h-10 w-24 rounded bg-surface-container-high" />
        </div>
      </div>
    </main>
  );
}
