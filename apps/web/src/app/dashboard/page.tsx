import { DashboardOverviewView } from "@/components/dashboard/dashboard-overview-view";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { OrgSubmittedAlert } from "@/components/dashboard/org-submitted-alert";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";
import type { ProfileAddressRow } from "@/components/dashboard/profile-settings-board";
import { getServerDataContainer } from "@/lib/data/container.server";
import type {
  ArtistFollowRow,
  BidWithLot,
  KycStatusSummaryDto,
  OrgOnboardingResumeVm,
  WatchlistWithLotRow,
} from "@/lib/data/dto/dashboard-dtos";
import { buildDashboardActivityVm } from "@/lib/data/view-models/dashboard-activity.vm";
import { buildDashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import { formatMoney } from "@/lib/format-currency";
import type { ItemSubmission, Lot, PortfolioRow, UserNotification } from "@auction/types";
import { Suspense } from "react";

function sliceError(e: unknown, fallback: string): string {
  return e instanceof Error ? e.message : fallback;
}

function takeSettled<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
  onReject: (message: string) => void,
  userMessage: string,
): T {
  if (result.status === "fulfilled") return result.value;
  onReject(sliceError(result.reason, userMessage));
  return fallback;
}

async function DashboardHomeContent({ orgSubmitted }: { orgSubmitted: boolean }) {
  const c = await getServerDataContainer();

  const [
    userR,
    activeR,
    portfolioR,
    watchlistR,
    artistFollowR,
    bidsR,
    submissionsR,
    kycR,
    orgR,
    addressesR,
    notificationsR,
  ] = await Promise.allSettled([
    c.session.getCurrent(),
    c.activeLots.listActivePreview(8),
    c.portfolio.listMine(),
    c.watchlist.listMine(),
    c.artistFollow.listMine(),
    c.bids.listMine(),
    c.submissions.listMine({ limit: 100 }),
    c.kyc.getSummary(),
    c.orgOnboarding.getResume(),
    c.addresses.listMine(),
    c.notifications.listMine({ limit: 12 }),
  ]);

  const errors = {
    session: null as string | null,
    active: null as string | null,
    portfolio: null as string | null,
    watchlist: null as string | null,
    artistFollow: null as string | null,
    bids: null as string | null,
    submissions: null as string | null,
  };

  const user = userR.status === "fulfilled" ? userR.value : null;
  if (userR.status === "rejected") {
    errors.session = sliceError(userR.reason, "Could not load your session.");
  }

  const active: Lot[] = takeSettled(
    activeR,
    [],
    (msg) => {
      errors.active = msg;
    },
    "Could not load live inventory.",
  );

  const portfolio: PortfolioRow[] = takeSettled(
    portfolioR,
    [],
    (msg) => {
      errors.portfolio = msg;
    },
    "Could not load portfolio.",
  );

  const watchlist: WatchlistWithLotRow[] = takeSettled(
    watchlistR,
    [],
    (msg) => {
      errors.watchlist = msg;
    },
    "Could not load watchlist.",
  );

  const artistFollow: ArtistFollowRow[] = takeSettled(
    artistFollowR,
    [],
    (msg) => {
      errors.artistFollow = msg;
    },
    "Could not load followed artists.",
  );

  const bidRows: BidWithLot[] = takeSettled(
    bidsR,
    [],
    (msg) => {
      errors.bids = msg;
    },
    "Could not load bids.",
  );

  const submissions: ItemSubmission[] = takeSettled(
    submissionsR,
    [],
    (msg) => {
      errors.submissions = msg;
    },
    "Could not load submissions.",
  );

  const kyc: KycStatusSummaryDto | null = kycR.status === "fulfilled" ? kycR.value : null;
  const orgOnboarding: OrgOnboardingResumeVm | null =
    orgR.status === "fulfilled" ? orgR.value : null;
  const addresses: ProfileAddressRow[] = addressesR.status === "fulfilled" ? addressesR.value : [];
  const notifications: UserNotification[] =
    notificationsR.status === "fulfilled" ? notificationsR.value : [];

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

  const activity = buildDashboardActivityVm({
    notifications,
    portfolio,
    bidRows,
    limit: 8,
  });

  return (
    <DashboardPage>
      {orgSubmitted ? <OrgSubmittedAlert /> : null}
      <DashboardOverviewView
        vm={vm}
        user={
          user ?? {
            emailVerified: false,
            emailStatus: "ok",
            twoFactorEnabled: false,
            kycStatus: "unverified",
          }
        }
        kyc={kyc}
        orgOnboarding={orgOnboarding}
        addressesCount={addresses.length}
        activity={activity}
      />
    </DashboardPage>
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
    <Suspense fallback={<DashboardSkeleton variant="dashboard" />}>
      <DashboardHomeContent orgSubmitted={orgSubmitted} />
    </Suspense>
  );
}
