import { ArtistFollowSection } from "@/components/dashboard/artist-follow/artist-follow-section";
import { DashboardListPage } from "@/components/dashboard/dashboard-list-page";
import { AccountListSkeleton } from "@/components/dashboard/primitives/account-list-skeleton";
import {
  ARTISTS_YOU_FOLLOW_HREF,
  WatchingView,
} from "@/components/dashboard/watchlist/watching-view";
import {
  WATCHLIST_SORT_OPTIONS,
  type WatchlistSortOption,
} from "@/lib/dashboard/filters/watchlist/watchlist-filters";
import { getServerDataContainer } from "@/lib/data/container.server";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { type WatchingVm, buildWatchingVm, parseWatchingTab } from "@/lib/watching/watching.vm";
import { Button } from "@auction/ui/components/button";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Watching" };

type PageSearchParams = { sort?: string; tab?: string; q?: string; section?: string };

/** Closing soonest first, unless the person chose another order. */
function parseSort(raw: string | undefined): WatchlistSortOption {
  return WATCHLIST_SORT_OPTIONS.find((option) => option.value === raw)?.value ?? "endingSoon";
}

async function loadWatching(sp: PageSearchParams, sort: WatchlistSortOption) {
  const c = await getServerDataContainer();
  const [rowsResult, bidsResult, userResult] = await Promise.allSettled([
    c.watchlist.listMine({ sort, categoryIds: [] }),
    c.buying.bids(),
    c.session.getCurrent(),
  ]);
  if (rowsResult.status === "rejected") return null;
  return buildWatchingVm({
    rows: rowsResult.value,
    // Bids only add the person's standing to the pill; the page works without them.
    bids: bidsResult.status === "fulfilled" ? bidsResult.value : [],
    userId: userResult.status === "fulfilled" ? userResult.value?.id : undefined,
    tab: parseWatchingTab(sp.tab),
  });
}

export default async function DashboardWatchlistPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const sp = await searchParams;

  if (sp.section === "artists") {
    return (
      <DashboardListPage
        title="Artists you follow"
        description="We'll tell you when their work comes to a sale."
        meta={
          <Link
            href={CLIENT_ROUTES.watching}
            className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
          >
            <ChevronLeft className="size-4" aria-hidden />
            Watching
          </Link>
        }
      >
        <Suspense
          fallback={<AccountListSkeleton label="Loading the artists you follow" tabs={false} />}
        >
          <ArtistFollowSection
            searchParams={Promise.resolve({
              ...(sp.q ? { q: sp.q } : {}),
              ...(sp.sort ? { sort: sp.sort } : {}),
            })}
          />
        </Suspense>
      </DashboardListPage>
    );
  }

  const sort = parseSort(sp.sort);
  const vm: WatchingVm | null = await loadWatching(sp, sort);
  return (
    <DashboardListPage
      title="Watching"
      description="Lots you're following. We'll remind you an hour before they close."
      actions={
        <Button variant="ghost" size="default" asChild>
          <Link href={ARTISTS_YOU_FOLLOW_HREF}>Artists you follow</Link>
        </Button>
      }
    >
      <WatchingView vm={vm} sort={sort} />
    </DashboardListPage>
  );
}
