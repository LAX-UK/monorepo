import { AccountLoadError } from "@/components/dashboard/primitives/account-load-error";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import { ACCOUNT_LOAD_ERROR, DASHBOARD_CTA, DASHBOARD_EMPTY } from "@/lib/dashboard/dashboard-copy";
import type { WatchlistSortOption } from "@/lib/dashboard/filters/watchlist/watchlist-filters";
import { calendarSalesHref } from "@/lib/marketing/sales-calendar-params";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import type { WatchingTab, WatchingVm } from "@/lib/watching/watching.vm";
import { AccountViewTabs } from "@auction/marketing-ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import { WatchedLotCard } from "./watched-lot-card";
import { WatchingSortSelect } from "./watching-sort-select";

const EMPTY_VIEW: Record<WatchingTab, { title: string; description: string }> = {
  upcoming: {
    title: "Nothing coming up",
    description: "Lots you follow in sales that have not opened yet appear here.",
  },
  live: {
    title: "Nothing live right now",
    description: "When a lot you follow opens for bidding, it moves here.",
  },
  ended: {
    title: "Nothing ended yet",
    description: "Lots you follow move here once their sale closes.",
  },
};

export const ARTISTS_YOU_FOLLOW_HREF = `${CLIENT_ROUTES.watching}?section=artists`;

function tabHref(tab: WatchingTab, sort: WatchlistSortOption): string {
  return `${CLIENT_ROUTES.watching}?tab=${tab}&sort=${sort}`;
}

function FollowLotsYouLike() {
  return (
    <DashboardEmptyState
      variant="hero"
      illustration="frame"
      title={DASHBOARD_EMPTY.watchlist.title}
      description={DASHBOARD_EMPTY.watchlist.description}
      action={
        <Button variant="secondaryOutline" asChild>
          <Link href={calendarSalesHref({ tab: "upcoming" })}>{DASHBOARD_CTA.browseLots}</Link>
        </Button>
      }
    />
  );
}

/**
 * The body of Watching: the views (Upcoming, Live, Ended), the order, and the followed lots as
 * catalogue cards. `vm` is `null` when the list could not be read.
 */
export function WatchingView({ vm, sort }: { vm: WatchingVm | null; sort: WatchlistSortOption }) {
  if (!vm) return <AccountLoadError {...ACCOUNT_LOAD_ERROR.watching} />;
  if (vm.total === 0) return <FollowLotsYouLike />;
  const empty = EMPTY_VIEW[vm.tab];
  return (
    <div className="flex flex-col gap-5">
      <AccountViewTabs
        label="Lots you follow"
        currentId={vm.tab}
        tabs={vm.tabs.map((tab) => ({ ...tab, href: tabHref(tab.id, sort) }))}
      />
      {vm.cards.length === 0 ? (
        <DashboardEmptyState
          illustration="frame"
          title={empty.title}
          description={empty.description}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-body text-sm text-on-surface-variant">{vm.summary}</p>
            <WatchingSortSelect value={sort} />
          </div>
          <ul
            className="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4"
            aria-label="Lots you follow"
          >
            {vm.cards.map((card) => (
              <li key={card.lotId} className="min-w-0">
                <WatchedLotCard card={card} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
