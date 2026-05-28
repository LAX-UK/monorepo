import { MarketingListSkeleton } from "@/components/marketing/marketing-list-skeleton";
import { MARKETING_CATALOG_PT, MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";

export default function MarketingLoading() {
  return (
    <main
      id="main-content"
      className={cn(
        "bg-surface pb-[var(--page-bottom-padding)]",
        MARKETING_CATALOG_PT,
        MARKETING_PAGE_SHELL,
      )}
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
