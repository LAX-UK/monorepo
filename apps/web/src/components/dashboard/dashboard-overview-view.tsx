import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { ActiveBidsCard } from "@/components/dashboard/overview/active-bids-card";
import { ComplianceStatusStrip } from "@/components/dashboard/overview/compliance-status-strip";
import { DashboardOverviewLayout } from "@/components/dashboard/overview/dashboard-overview-layout";
import { OverviewErrorsAlert } from "@/components/dashboard/overview/overview-errors-alert";
import { OverviewHeroBand } from "@/components/dashboard/overview/overview-hero-band";
import { SellCtaBand } from "@/components/dashboard/overview/sell-cta-band";
import { shouldShowComplianceStrip } from "@/components/dashboard/overview/should-show-compliance-strip";
import { WatchlistPreviewCard } from "@/components/dashboard/overview/watchlist-preview-card";
import type { SessionUser } from "@/lib/data/contracts";
import type { KycStatusSummaryDto, OrgOnboardingResumeVm } from "@/lib/data/dto/dashboard-dtos";
import type { ActivityItem } from "@/lib/data/view-models/dashboard-activity.vm";
import type { DashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";

type SessionComplianceUser = Pick<
  SessionUser,
  "emailVerified" | "emailStatus" | "kycStatus" | "twoFactorEnabled"
>;

type Props = {
  vm: DashboardOverviewVm;
  user: SessionComplianceUser | null;
  kyc?: KycStatusSummaryDto | null;
  orgOnboarding?: OrgOnboardingResumeVm | null;
  orgModuleEnabled?: boolean;
  /** null when the addresses slice failed — suppresses the address pill. */
  addressesCount?: number | null;
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
  const resolvedAddressesCount = addressesCount ?? 0;
  const showCompliance =
    user !== null &&
    shouldShowComplianceStrip(user, kyc, addressesCount === null ? 1 : resolvedAddressesCount);

  return (
    <>
      <OverviewErrorsAlert errors={vm.errors} />
      <DashboardOverviewLayout
        slots={{
          compliance:
            showCompliance && user ? (
              <ComplianceStatusStrip
                user={user}
                kyc={kyc}
                addressesCount={resolvedAddressesCount}
                hideIdentityPill={kyc?.requiresKyc === true}
                hideAddressPill={addressesCount === null}
              />
            ) : null,
          kpis: (
            <OverviewHeroBand
              vm={vm}
              kyc={kyc}
              orgOnboarding={orgOnboarding}
              orgModuleEnabled={orgModuleEnabled}
              suppressKycAttention={showCompliance}
              suppressOrgOnboardingAttention={orgModuleEnabled && orgOnboarding != null}
            />
          ),
          activity: <ActiveBidsCard vm={vm} />,
          activityFeed: <ActivityFeed items={activity} />,
          watchlist: <WatchlistPreviewCard vm={vm} variant="tile-grid" />,
          secondary: (
            <div
              className={
                vm.kpi.activeBidsCount > 0 || vm.settlementsDue.length > 0 || vm.outbidCount > 0
                  ? "hidden lg:block"
                  : undefined
              }
            >
              <SellCtaBand vm={vm} />
            </div>
          ),
        }}
      />
      {vm.kpi.activeBidsCount > 0 || vm.settlementsDue.length > 0 || vm.outbidCount > 0 ? (
        <div className="lg:hidden">
          <SellCtaBand vm={vm} />
        </div>
      ) : null}
    </>
  );
}
