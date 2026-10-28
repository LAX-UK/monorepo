import { AccountLoadError } from "@/components/dashboard/primitives/account-load-error";
import { DashboardEmptyState } from "@/components/dashboard/primitives/dashboard-empty-state";
import type { MyBidTab } from "@/lib/bid/my-bid-status";
import type { MyBidsVm } from "@/lib/bid/my-bids.vm";
import { ACCOUNT_LOAD_ERROR, DASHBOARD_CTA, DASHBOARD_EMPTY } from "@/lib/dashboard/dashboard-copy";
import { calendarSalesHref } from "@/lib/marketing/sales-calendar-params";
import { CLIENT_ROUTES } from "@/lib/navigation/client-routes";
import { AccountViewTabs } from "@auction/marketing-ui";
import { Button } from "@auction/ui/components/button";
import { Info } from "lucide-react";
import Link from "next/link";
import { MyBidsList } from "./my-bids-list";
import { MyBidsLiveUpdates } from "./my-bids-live-updates";

/** A view with nothing in it while other views have lots: a quiet line, not the full invitation. */
const EMPTY_VIEW: Record<MyBidTab, { title: string; description: string }> = {
  active: {
    title: "No open bids",
    description: "Lots you bid on stay here until their sale closes.",
  },
  won: {
    title: "No wins yet",
    description: "Lots you win move here, and to Purchases for payment and delivery.",
  },
  lost: {
    title: "Nothing missed",
    description: "Lots that close above your bid are listed here.",
  },
};

export const BROWSE_UPCOMING_SALES_HREF = calendarSalesHref({ tab: "upcoming" });

function tabHref(tab: MyBidTab): string {
  return tab === "active" ? CLIENT_ROUTES.bids : `${CLIENT_ROUTES.bids}?tab=${tab}`;
}

function PriceNote() {
  return (
    <p className="flex items-center gap-1.5 font-body text-xs text-on-surface-variant">
      <Info className="size-3.5 shrink-0" aria-hidden />
      Bids are in GBP and exclude buyer's premium.
    </p>
  );
}

/** Nothing bid on anywhere: invite the person to the sales. */
function NoBidsYet() {
  return (
    <DashboardEmptyState
      variant="hero"
      illustration="gavel"
      title={DASHBOARD_EMPTY.bids.title}
      description={DASHBOARD_EMPTY.bids.description}
      action={
        <>
          <Button variant="primary" asChild>
            <Link href={BROWSE_UPCOMING_SALES_HREF}>{DASHBOARD_CTA.browseUpcomingSales}</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/buy">{DASHBOARD_CTA.howBiddingWorks}</Link>
          </Button>
        </>
      }
    />
  );
}

type MyBidsViewProps = {
  /** `null` when the bids could not be read: the page says so calmly and offers to try again. */
  vm: MyBidsVm | null;
  userId: string | null;
};

/**
 * The body of My bids: the views, a card per lot and live updates while lots are open. The same
 * body serves a personal account on the public site and an organisation in its workspace.
 */
export function MyBidsView({ vm, userId }: MyBidsViewProps) {
  if (!vm) return <AccountLoadError {...ACCOUNT_LOAD_ERROR.bids} />;
  const total = vm.tabs.reduce((sum, tab) => sum + tab.count, 0);
  if (total === 0) return <NoBidsYet />;
  const empty = EMPTY_VIEW[vm.tab];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <AccountViewTabs
          label="Bids"
          currentId={vm.tab}
          tabs={vm.tabs.map((tab) => ({ ...tab, href: tabHref(tab.id) }))}
        />
        <PriceNote />
      </div>
      {vm.cards.length === 0 ? (
        <DashboardEmptyState
          illustration="gavel"
          title={empty.title}
          description={empty.description}
        />
      ) : (
        <MyBidsList cards={vm.cards} />
      )}
      {userId ? <MyBidsLiveUpdates userId={userId} lots={vm.liveLots} /> : null}
    </div>
  );
}
