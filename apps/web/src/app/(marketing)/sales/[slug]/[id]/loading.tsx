import { MarketingCatalogToolbarSkeleton } from "@/components/marketing/marketing-catalog-toolbar-skeleton";
import { MarketingDetailShell } from "@/components/marketing/marketing-detail-shell";
import { MarketingListSkeleton } from "@/components/marketing/marketing-list-skeleton";
import { MARKETING_PAGE_SHELL, SALE_ANCHOR_STICKY_CLASS } from "@/lib/marketing/chrome";
import { readSkeletonView } from "@/lib/preferences/skeleton-view.server";
import { cn } from "@auction/ui";

const pulse = "animate-pulse rounded bg-surface-container-high";

export default async function SaleroomCatalogLoading() {
  const view = await readSkeletonView("sales-lot", "grid");

  return (
    <MarketingDetailShell
      className="lg:pb-24"
      wrapChildren={false}
      aria-busy="true"
      aria-label="Loading sale catalogue"
      leadingChrome={
        <div className={cn(pulse, "h-12 w-full bg-surface-container-high lg:hidden")} aria-hidden />
      }
      hero={
        <header className={MARKETING_PAGE_SHELL}>
          <div className="flex flex-col gap-6 pb-10 pt-6 md:gap-8 md:pb-14 md:pt-8">
            <div className={cn(pulse, "h-4 w-3/4 max-w-md")} aria-hidden />
            <div className={cn(pulse, "h-4 w-48")} aria-hidden />
            <div className={cn(pulse, "h-10 w-full max-w-2xl")} aria-hidden />
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start lg:gap-10">
              <div className={cn(pulse, "aspect-video w-full")} aria-hidden />
              <div className="flex flex-col gap-6">
                <div className={cn(pulse, "h-20 w-full")} aria-hidden />
                <div className={cn(pulse, "h-12 w-2/3")} aria-hidden />
                <div className={cn(pulse, "h-10 w-40 self-end")} aria-hidden />
              </div>
            </div>
          </div>
        </header>
      }
    >
      <div
        className={cn(SALE_ANCHOR_STICKY_CLASS, "border-b border-outline-variant/30 bg-page-bg/90")}
        aria-hidden
      >
        <div className="mx-auto flex max-w-[var(--container-max,1440px)] gap-4 px-8 py-3 md:px-10 lg:px-14">
          <div className={cn(pulse, "h-5 w-20")} />
          <div className={cn(pulse, "h-5 w-24")} />
          <div className={cn(pulse, "h-5 w-20")} />
        </div>
      </div>

      <section className={cn(MARKETING_PAGE_SHELL, "pt-[var(--section-spacing-tight)]")}>
        <div className={cn(pulse, "mb-4 h-8 w-24")} aria-hidden />
        <MarketingCatalogToolbarSkeleton showActiveChips />
        <div className="mt-8">
          <MarketingListSkeleton
            view={view}
            count={8}
            className="gap-7 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          />
        </div>
      </section>
    </MarketingDetailShell>
  );
}
