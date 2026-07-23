import { DashboardOverviewView } from "@/components/dashboard/dashboard-overview-view";
import { DashboardPage } from "@/components/dashboard/dashboard-page";
import { DashboardSliceErrorAlert } from "@/components/dashboard/dashboard-slice-error-alert";
import { OrgSubmittedAlert } from "@/components/dashboard/org-submitted-alert";
import { buildOverviewDescription } from "@/components/dashboard/overview/overview-presenters";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import { DashboardSkeleton } from "@/components/dashboard/primitives/dashboard-skeleton";
import { buildDashboardOverviewVm } from "@/lib/buyer-account";
import type { ProfileAddressRow } from "@/lib/buyer-account";
import {
  dashboardSliceFailureMessage,
  describeSessionsOverviewError,
} from "@/lib/dashboard/dashboard-fetch-errors";
import { getServerDataContainer } from "@/lib/data/container.server";
import type {
  ArtistFollowRow,
  BidWithLot,
  KycStatusSummaryDto,
  OrgOnboardingResumeVm,
  WatchlistWithLotRow,
} from "@/lib/data/dto/dashboard-dtos";
import { buildDashboardActivityVm } from "@/lib/data/view-models/dashboard-activity.vm";
import { formatMoney } from "@/lib/format-currency";
import { resolveOrgModuleEnabledFromRequest } from "@/lib/legal-entity/org-module-host.server";
import {
  CLIENT_WORKSPACE_COOKIE,
  clientWorkspaceOverviewMeta,
  parseClientWorkspaceMode,
} from "@/lib/workspace/client-workspace-mode";
import type { ItemSubmission, Lot, PortfolioRow, UserNotification } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";

function takeSettledSlice<T>(
  result: PromiseSettledResult<T>,
  slice: Parameters<typeof dashboardSliceFailureMessage>[1],
  fallback: T,
  onReject: (message: string) => void,
  userMessage: string,
): T {
  if (result.status === "fulfilled") return result.value;
  onReject(dashboardSliceFailureMessage(result.reason, slice, userMessage));
  return fallback;
}

async function DashboardHomeContent({
  orgSubmitted,
  sessionsFailure,
  orgModuleEnabled,
  clientWorkspaceMode,
}: {
  orgSubmitted: boolean;
  sessionsFailure: ReturnType<typeof describeSessionsOverviewError> | null;
  orgModuleEnabled: boolean;
  clientWorkspaceMode: ReturnType<typeof parseClientWorkspaceMode>;
}) {
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
    orgModuleEnabled ? c.orgOnboarding.getResume() : Promise.resolve(null),
    c.addresses.listMine(),
    c.notifications.listMineSafe({ limit: 12 }),
  ]);

  const errors = {
    session: sessionsFailure?.message ?? null,
    active: null as string | null,
    portfolio: null as string | null,
    watchlist: null as string | null,
    artistFollow: null as string | null,
    bids: null as string | null,
    submissions: null as string | null,
    notifications: null as string | null,
    addresses: null as string | null,
  };

  const user = userR.status === "fulfilled" ? userR.value : null;
  if (userR.status === "rejected") {
    errors.session = dashboardSliceFailureMessage(
      userR.reason,
      "session",
      "Could not load your session.",
    );
  }

  const active: Lot[] = takeSettledSlice(
    activeR,
    "activeLots",
    [],
    (msg) => {
      errors.active = msg;
    },
    "Could not load live inventory.",
  );

  const portfolio: PortfolioRow[] = takeSettledSlice(
    portfolioR,
    "portfolio",
    [],
    (msg) => {
      errors.portfolio = msg;
    },
    "Could not load portfolio.",
  );

  const watchlist: WatchlistWithLotRow[] = takeSettledSlice(
    watchlistR,
    "watchlist",
    [],
    (msg) => {
      errors.watchlist = msg;
    },
    "Could not load watchlist.",
  );

  const artistFollow: ArtistFollowRow[] = takeSettledSlice(
    artistFollowR,
    "artistFollow",
    [],
    (msg) => {
      errors.artistFollow = msg;
    },
    "Could not load followed artists.",
  );

  const bidRows: BidWithLot[] = takeSettledSlice(
    bidsR,
    "bids",
    [],
    (msg) => {
      errors.bids = msg;
    },
    "Could not load bids.",
  );

  const submissions: ItemSubmission[] = takeSettledSlice(
    submissionsR,
    "submissions",
    [],
    (msg) => {
      errors.submissions = msg;
    },
    "Could not load submissions.",
  );

  const kyc: KycStatusSummaryDto | null = kycR.status === "fulfilled" ? kycR.value : null;
  const orgOnboarding: OrgOnboardingResumeVm | null =
    orgR.status === "fulfilled" ? orgR.value : null;
  const addresses: ProfileAddressRow[] = takeSettledSlice(
    addressesR,
    "addresses",
    [],
    (msg) => {
      errors.addresses = msg;
    },
    "Could not load addresses.",
  );
  let notifications: UserNotification[] = [];
  if (notificationsR.status === "fulfilled") {
    notifications = notificationsR.value.items;
    if (notificationsR.value.failed) {
      errors.notifications = dashboardSliceFailureMessage(
        new Error("notifications_unavailable"),
        "notifications",
        "Could not load recent activity.",
      );
    }
  } else {
    errors.notifications = dashboardSliceFailureMessage(
      notificationsR.reason,
      "notifications",
      "Could not load recent activity.",
    );
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

  const activity = buildDashboardActivityVm({
    notifications,
    portfolio,
    bidRows,
    limit: 8,
  });

  return (
    <DashboardPage>
      {orgSubmitted && orgModuleEnabled ? <OrgSubmittedAlert /> : null}
      {sessionsFailure && userR.status !== "rejected" ? (
        <DashboardSliceErrorAlert failure={sessionsFailure} />
      ) : null}
      <DashboardPageHeader
        meta={clientWorkspaceOverviewMeta(clientWorkspaceMode)}
        titleScale="display"
        title={`Welcome back, ${vm.firstName}`}
        hideTitleOnMobile
        hideDescriptionOnMobile
        description={buildOverviewDescription(vm, clientWorkspaceMode)}
        actions={
          <Button variant="outline" asChild>
            <Link href={vm.primaryCta?.href ?? "/search"}>
              {vm.primaryCta?.label ?? "Browse auctions"}
            </Link>
          </Button>
        }
      />
      <DashboardOverviewView
        vm={vm}
        user={user}
        kyc={kyc}
        orgOnboarding={orgModuleEnabled ? orgOnboarding : null}
        orgModuleEnabled={orgModuleEnabled}
        addressesCount={errors.addresses ? null : addresses.length}
        activity={activity}
        clientWorkspaceMode={clientWorkspaceMode}
      />
    </DashboardPage>
  );
}

export default async function DashboardHomePage({
  searchParams,
}: {
  searchParams: Promise<{ org_submitted?: string; error?: string; code?: string }>;
}) {
  const sp = await searchParams;
  const orgSubmitted = sp.org_submitted === "1";
  const sessionsFailure =
    sp.error === "sessions" ? describeSessionsOverviewError(sp.code ?? null) : null;
  const orgModuleEnabled = await resolveOrgModuleEnabledFromRequest();
  const jar = await cookies();
  const clientWorkspaceMode = parseClientWorkspaceMode(jar.get(CLIENT_WORKSPACE_COOKIE)?.value);
  return (
    <Suspense fallback={<DashboardSkeleton variant="dashboard" />}>
      <DashboardHomeContent
        orgSubmitted={orgSubmitted}
        sessionsFailure={sessionsFailure}
        orgModuleEnabled={orgModuleEnabled}
        clientWorkspaceMode={clientWorkspaceMode}
      />
    </Suspense>
  );
}
