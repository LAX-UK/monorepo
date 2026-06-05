import { MARKETING_CATALOG_PT, MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { cn } from "@auction/ui";

export default function LotLoading() {
  return (
    <main
      id="main-content"
      className={cn(
        MARKETING_PAGE_SHELL,
        MARKETING_CATALOG_PT,
        "bg-page-bg pb-[calc(var(--page-bottom-padding)+4rem)] dark:bg-background md:pb-[var(--page-bottom-padding)]",
      )}
      aria-busy="true"
      aria-label="Loading lot"
    >
      <div className="animate-pulse space-y-10">
        <div className="space-y-3 pt-4 md:pt-6">
          <div className="h-4 w-40 rounded bg-surface-container-high" />
          <div className="h-3 w-56 rounded bg-surface-container-high" />
        </div>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)_minmax(0,440px)] lg:items-start lg:gap-6">
          <div className="hidden space-y-4 lg:block">
            <div className="h-3 w-16 rounded bg-surface-container-high" />
            <div className="h-28 w-full rounded-lg bg-surface-container-high" />
            <div className="h-3 w-20 rounded bg-surface-container-high" />
            <div className="h-24 w-full rounded-lg bg-surface-container-high" />
          </div>
          <div className="space-y-6 lg:col-start-2">
            <div className="aspect-[786/502] w-full max-w-[786px] rounded-lg bg-surface-container-high" />
            <div className="h-10 w-full max-w-[786px] rounded-full bg-surface-container-high lg:hidden" />
            <div className="h-10 w-full max-w-[786px] rounded bg-surface-container-high" />
            <div className="h-32 w-full max-w-[786px] rounded bg-surface-container-high" />
          </div>
          <div className="hidden space-y-4 lg:block lg:col-start-3">
            <div className="h-10 w-full rounded-full bg-surface-container-high" />
            <div className="h-48 w-full rounded bg-surface-container-high" />
            <div className="h-12 w-full rounded bg-surface-container-high" />
          </div>
        </div>
      </div>

      <div
        className="fixed inset-x-0 bottom-[var(--sticky-bid-bar-bottom,0px)] z-40 border-t border-border-hairline bg-surface/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
        aria-hidden
      >
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="h-3 w-20 rounded bg-surface-container-high" />
            <div className="h-5 w-28 rounded bg-surface-container-high" />
          </div>
          <div className="h-11 w-28 rounded bg-surface-container-high" />
        </div>
      </div>
    </main>
  );
}
