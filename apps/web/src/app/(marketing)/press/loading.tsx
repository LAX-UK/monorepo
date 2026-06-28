import { MarketingCatalogHubShell } from "@/components/marketing/marketing-catalog-hub-shell";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";

const PRESS_LOADING_SKELETON_IDS = [
  "press-skeleton-a",
  "press-skeleton-b",
  "press-skeleton-c",
  "press-skeleton-d",
  "press-skeleton-e",
  "press-skeleton-f",
] as const;

const DAY_MEDIA_SKELETON_IDS = ["press-day-a", "press-day-b", "press-day-c"] as const;

export default function PressLoading() {
  return (
    <MarketingCatalogHubShell
      aria-busy="true"
      aria-label="Loading press centre"
      className="bg-page-bg"
      hero={
        <div
          className={cn(
            "animate-pulse space-y-4 border-b border-border-hairline py-8 md:py-12",
            MARKETING_PAGE_SHELL,
          )}
        >
          <div className="h-4 w-32 rounded bg-surface-container-high" />
          <div className="h-10 w-2/3 max-w-md rounded bg-surface-container-high" />
          <div className="h-4 w-full max-w-xl rounded bg-surface-container-high" />
          <div className="h-4 w-64 rounded bg-surface-container-high" />
        </div>
      }
    >
      <div className="flex flex-col gap-12 animate-pulse">
        <div className="flex flex-col gap-6">
          <div className="space-y-2">
            <div className="h-8 w-48 rounded bg-surface-container-high" />
            <div className="h-4 w-72 rounded bg-surface-container-high" />
          </div>
          <div className="border-b border-border-hairline pb-4">
            <div className="h-11 rounded bg-surface-container-high" />
            <div className="mt-3 h-4 w-24 rounded bg-surface-container-high" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRESS_LOADING_SKELETON_IDS.map((id) => (
              <div key={id} className="h-48 rounded-xl bg-surface-container-low" />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="space-y-2">
            <div className="h-8 w-56 rounded bg-surface-container-high" />
            <div className="h-4 w-full max-w-2xl rounded bg-surface-container-high" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {DAY_MEDIA_SKELETON_IDS.map((id) => (
              <div key={id} className="aspect-[16/10] rounded-xl bg-surface-container-low" />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="h-8 w-40 rounded bg-surface-container-high" />
          <div className="h-4 w-full max-w-xl rounded bg-surface-container-high" />
          <div className="h-4 w-2/3 max-w-lg rounded bg-surface-container-high" />
        </div>
      </div>
    </MarketingCatalogHubShell>
  );
}
