import { DashboardOverviewView } from "@/components/dashboard/dashboard-overview-view";
import { getServerDataContainer } from "@/lib/data/container.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { getMySubmissions } from "@/lib/data/http/submissions.server";
import { buildDashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import { isDashboardV2Enabled } from "@/lib/feature-flags/dashboard-v2";
import { formatMoney } from "@/lib/format-currency";
import { Alert, AlertDescription, AlertTitle } from "@auction/ui/components/alert";
import { PageSkeleton } from "@auction/ui/components/page-skeleton";
import { Suspense } from "react";

async function DashboardHomeContent({ orgSubmitted }: { orgSubmitted: boolean }) {
  const user = await getServerSessionUser();
  const c = await getServerDataContainer();

  let active: Awaited<ReturnType<typeof c.activeLots.listActivePreview>> = [];
  let portfolio: Awaited<ReturnType<typeof c.portfolio.listMine>> = [];
  let watchlist: Awaited<ReturnType<typeof c.watchlist.listMine>> = [];
  let artistFollow: Awaited<ReturnType<typeof c.artistFollow.listMine>> = [];
  let bidRows: Awaited<ReturnType<typeof c.bids.listMine>> = [];
  let submissions: Awaited<ReturnType<typeof getMySubmissions>> = [];

  const errors = {
    active: null as string | null,
    portfolio: null as string | null,
    watchlist: null as string | null,
    artistFollow: null as string | null,
    bids: null as string | null,
    submissions: null as string | null,
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

  try {
    submissions = await getMySubmissions({ limit: 100 });
  } catch (e) {
    submissions = [];
    errors.submissions = e instanceof Error ? e.message : "Could not load submissions.";
  }

  const vm = buildDashboardOverviewVm({
    user,
    activeLots: active,
    portfolio,
    watchlist,
    artistFollow,
    submissionsCount: submissions.length,
    bidRows,
    errors,
    formatMoney,
  });

  return (
    <>
      {orgSubmitted ? (
        <Alert className="mb-6 border-lot-orange/40 bg-surface-container-low/80" variant="default">
          <AlertTitle>Organisation submitted</AlertTitle>
          <AlertDescription className="text-on-surface">
            Your organisation is being reviewed. We&apos;ll notify you when approved.
          </AlertDescription>
        </Alert>
      ) : null}
      <DashboardOverviewView vm={vm} featureV2={isDashboardV2Enabled()} />
    </>
  );
}

export default async function DashboardHomePage({
  searchParams,
}: {
  searchParams: Promise<{ org_submitted?: string }>;
}) {
  const sp = await searchParams;
  const orgSubmitted = sp.org_submitted === "1";
  return (
    <Suspense fallback={<PageSkeleton variant="dashboard" />}>
      <DashboardHomeContent orgSubmitted={orgSubmitted} />
    </Suspense>
  );
}
