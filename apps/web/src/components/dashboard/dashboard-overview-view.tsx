import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { ActionRequiredBanner } from "@/components/dashboard/overview/action-required-banner";
import { ActiveBidsCard } from "@/components/dashboard/overview/active-bids-card";
import { AttentionPanel } from "@/components/dashboard/overview/attention-panel";
import { ComplianceStatusStrip } from "@/components/dashboard/overview/compliance-status-strip";
import { DashboardOverviewLayout } from "@/components/dashboard/overview/dashboard-overview-layout";
import { OverviewErrorsAlert } from "@/components/dashboard/overview/overview-errors-alert";
import {
  buildOverviewDescription,
  buildOverviewKpiTiles,
} from "@/components/dashboard/overview/overview-presenters";
import { SecondaryActionStack } from "@/components/dashboard/overview/secondary-action-stack";
import { WatchlistPreviewCard } from "@/components/dashboard/overview/watchlist-preview-card";
import type { SessionUser } from "@/lib/data/contracts";
import type { KycStatusSummaryDto, OrgOnboardingResumeVm } from "@/lib/data/dto/dashboard-dtos";
import type { ActivityItem } from "@/lib/data/view-models/dashboard-activity.vm";
import type { DashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import { Button } from "@auction/ui/components/button";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

type Props = {
  vm: DashboardOverviewVm;
  user: Pick<SessionUser, "emailVerified" | "emailStatus" | "kycStatus" | "twoFactorEnabled">;
  kyc?: KycStatusSummaryDto | null;
  orgOnboarding?: OrgOnboardingResumeVm | null;
  addressesCount?: number;
  activity?: readonly ActivityItem[];
};

export function DashboardOverviewView({
  vm,
  user,
  kyc = null,
  orgOnboarding = null,
  addressesCount = 0,
  activity = [],
}: Props) {
  const firstSettlement = vm.settlementsDue[0];
  return (
    <>
      <OverviewErrorsAlert errors={vm.errors} />
      <DashboardOverviewLayout
        layout="stack"
        slots={{
          header: (
            <PageHeader
              className="mb-0 border-0 pb-0"
              meta={
                <span className="font-label text-[11px] font-semibold uppercase tracking-[0.22em] text-on-surface-variant">
                  Your dashboard
                </span>
              }
              title={`Welcome back, ${vm.firstName}`}
              description={buildOverviewDescription(vm)}
              actions={
                <Button variant="outline" asChild>
                  <Link href={vm.primaryCta?.href ?? "/search"}>
                    {vm.primaryCta?.label ?? "Browse auctions"}
                  </Link>
                </Button>
              }
            />
          ),
          compliance: (
            <ComplianceStatusStrip
              user={user}
              kyc={kyc}
              addressesCount={addressesCount}
              hideIdentityPill={kyc?.requiresKyc === true}
            />
          ),
          banner: <ActionRequiredBanner row={firstSettlement} />,
          attention: (
            <AttentionPanel
              vm={vm}
              kyc={kyc}
              orgOnboarding={orgOnboarding}
              skipFirstSettlement={Boolean(firstSettlement)}
            />
          ),
          kpis: <KpiGrid tiles={buildOverviewKpiTiles(vm)} />,
          activity: <ActiveBidsCard vm={vm} />,
          activityFeed: <ActivityFeed items={activity} />,
          watchlist: <WatchlistPreviewCard vm={vm} variant="tile-grid" />,
          secondary: <SecondaryActionStack vm={vm} />,
        }}
      />
    </>
  );
}
