import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { ActiveBidsCard } from "@/components/dashboard/overview/active-bids-card";
import { ComplianceStatusStrip } from "@/components/dashboard/overview/compliance-status-strip";
import { DashboardOverviewLayout } from "@/components/dashboard/overview/dashboard-overview-layout";
import { OverviewErrorsAlert } from "@/components/dashboard/overview/overview-errors-alert";
import { OverviewHeroBand } from "@/components/dashboard/overview/overview-hero-band";
import { buildOverviewDescription } from "@/components/dashboard/overview/overview-presenters";
import { SellCtaBand } from "@/components/dashboard/overview/sell-cta-band";
import { WatchlistPreviewCard } from "@/components/dashboard/overview/watchlist-preview-card";
import { DashboardPageHeader } from "@/components/dashboard/primitives/dashboard-page-header";
import type { SessionUser } from "@/lib/data/contracts";
import type { KycStatusSummaryDto, OrgOnboardingResumeVm } from "@/lib/data/dto/dashboard-dtos";
import type { ActivityItem } from "@/lib/data/view-models/dashboard-activity.vm";
import type { DashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

type Props = {
  vm: DashboardOverviewVm;
  user: Pick<SessionUser, "emailVerified" | "emailStatus" | "kycStatus" | "twoFactorEnabled">;
  kyc?: KycStatusSummaryDto | null;
  orgOnboarding?: OrgOnboardingResumeVm | null;
  orgModuleEnabled?: boolean;
  addressesCount?: number;
  activity?: readonly ActivityItem[];
  clientWorkspaceMode?: ClientWorkspaceMode;
};

export function DashboardOverviewView({
  vm,
  user,
  kyc = null,
  orgOnboarding = null,
  orgModuleEnabled = true,
  addressesCount = 0,
  activity = [],
}: Props) {
  return (
    <>
      <OverviewErrorsAlert errors={vm.errors} />
      <DashboardOverviewLayout
        layout="focal"
        slots={{
          header: (
            <DashboardPageHeader
              meta="Your dashboard"
              titleScale="display"
              title={`Welcome back, ${vm.firstName}`}
              hideTitleOnMobile
              hideDescriptionOnMobile
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
          kpis: (
            <OverviewHeroBand
              vm={vm}
              kyc={kyc}
              orgOnboarding={orgOnboarding}
              orgModuleEnabled={orgModuleEnabled}
            />
          ),
          activity: <ActiveBidsCard vm={vm} />,
          activityFeed: <ActivityFeed items={activity} />,
          watchlist: <WatchlistPreviewCard vm={vm} variant="tile-grid" />,
          secondary: <SellCtaBand vm={vm} />,
        }}
      />
    </>
  );
}
