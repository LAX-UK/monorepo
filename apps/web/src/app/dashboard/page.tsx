import { DashboardOverviewView } from "@/components/dashboard/dashboard-overview-view";
import { getServerDataContainer } from "@/lib/data/container.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { buildDashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import { formatMoney } from "@/lib/format-currency";
import { PageSkeleton } from "@auction/ui/components/page-skeleton";
import { Suspense } from "react";

async function DashboardHomeContent() {
  const user = await getServerSessionUser();
  const c = await getServerDataContainer();

  let active: Awaited<ReturnType<typeof c.activeLots.listActivePreview>> = [];
  let portfolio: Awaited<ReturnType<typeof c.portfolio.listMine>> = [];
  let watchlist: Awaited<ReturnType<typeof c.watchlist.listMine>> = [];
  let artistFollow: Awaited<ReturnType<typeof c.artistFollow.listMine>> = [];
  let bidRows: Awaited<ReturnType<typeof c.bids.listMine>> = [];

  const errors = {
    active: null as string | null,
    portfolio: null as string | null,
    watchlist: null as string | null,
    artistFollow: null as string | null,
    bids: null as string | null,
  };

  try {
    active = await c.activeLots.listActivePreview(8);
  } catch (e) {
    active = [];
    errors.active = e instanceof Error ? e.message : "Could not load live inventory.";
  }

  try {
    portfolio = await c.portfolio.listMine();
  } catch (e) {
    portfolio = [];
    errors.portfolio = e instanceof Error ? e.message : "Could not load portfolio.";
  }

  try {
    watchlist = await c.watchlist.listMine();
  } catch (e) {
    watchlist = [];
    errors.watchlist = e instanceof Error ? e.message : "Could not load watchlist.";
  }

  try {
    artistFollow = await c.artistFollow.listMine();
  } catch (e) {
    artistFollow = [];
    errors.artistFollow = e instanceof Error ? e.message : "Could not load followed artists.";
  }

  try {
    bidRows = await c.bids.listMine();
  } catch (e) {
    bidRows = [];
    errors.bids = e instanceof Error ? e.message : "Could not load bids.";
  }

  const vm = buildDashboardOverviewVm({
    user,
    activeLots: active,
    portfolio,
    watchlist,
    artistFollow,
    bidRows,
    errors,
    formatMoney,
  });

  return <DashboardOverviewView vm={vm} />;
}

export default function DashboardHomePage() {
  return (
    <Suspense fallback={<PageSkeleton variant="dashboard" />}>
      <DashboardHomeContent />
    </Suspense>
  );
}
