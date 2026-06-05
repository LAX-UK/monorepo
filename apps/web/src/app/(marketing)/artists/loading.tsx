import { MarketingCatalogHubShell } from "@/components/marketing/marketing-catalog-hub-shell";
import { MarketingCatalogToolbarSkeleton } from "@/components/marketing/marketing-catalog-toolbar-skeleton";
import { MarketingListSkeleton } from "@/components/marketing/marketing-list-skeleton";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import { readSkeletonView } from "@/lib/preferences/skeleton-view.server";
import { Skeleton } from "@auction/ui";

const CHIP_KEYS = ["chip-a", "chip-b", "chip-c", "chip-d", "chip-e"];
const RAIL_KEYS = ["rail-a", "rail-b", "rail-c", "rail-d"];

export default async function PublicArtistsDirectoryLoading() {
  const view = await readSkeletonView("artists", "grid");
  return (
    <MarketingCatalogHubShell
      className="overflow-x-clip"
      aria-busy="true"
      aria-label="Loading artists"
      hero={
        <section className="border-b border-border-hairline bg-surface-container-lowest/40 py-8 sm:py-12 md:py-14">
          <div className={MARKETING_PAGE_SHELL}>
            <Skeleton className="h-3 w-40" />
            <Skeleton className="mt-3 h-10 w-72" />
            <Skeleton className="mt-4 h-4 w-2/3" />
            <Skeleton className="mt-8 h-12 w-full max-w-xl" />
            <div className="mt-6 flex flex-wrap gap-2">
              {CHIP_KEYS.map((k) => (
                <Skeleton key={k} className="h-8 w-24 rounded-full" />
              ))}
            </div>
          </div>
        </section>
      }
    >
      <section className="py-8 sm:py-12 md:py-12">
        <div className="grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="hidden space-y-6 lg:block">
            <Skeleton className="h-3 w-24" />
            {RAIL_KEYS.map((k) => (
              <Skeleton key={k} className="h-7 w-full" />
            ))}
          </div>
          <div className="min-w-0">
            <MarketingCatalogToolbarSkeleton showDesktopFilters={false} showDesktopSort />
            <MarketingListSkeleton
              view={view}
              count={9}
              gridClassName="grid-cols-1 gap-3 sm:grid-cols-2 md:gap-6 lg:grid-cols-3"
              listThumbClassName="size-12 rounded-full"
              cardAspectClassName="aspect-video"
            />
          </div>
        </div>
      </section>
    </MarketingCatalogHubShell>
  );
}
