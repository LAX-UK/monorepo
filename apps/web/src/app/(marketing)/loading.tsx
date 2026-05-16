import { MarketingListSkeleton } from "@/components/marketing/marketing-list-skeleton";

export default function MarketingLoading() {
  return (
    <main
      id="main-content"
      className="mx-auto max-w-[var(--container-max,1440px)] bg-surface px-6 pb-24 pt-[var(--section-pt)] md:px-16"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="space-y-10">
        <div className="aspect-[16/9] w-full rounded-lg bg-surface-container-high shimmer-sweep" />
        <div className="space-y-3">
          <div className="h-8 w-72 rounded bg-surface-container-high shimmer-sweep" />
          <div className="h-4 w-full max-w-2xl rounded bg-surface-container-high shimmer-sweep" />
        </div>
        <MarketingListSkeleton view="grid" />
      </div>
    </main>
  );
}
