"use client";

import {
  DashboardBannerStack,
  type DashboardBannerStackProps,
} from "@/components/dashboard/dashboard-banner-stack";
import { isEntityStatusBannerVisible } from "@/components/dashboard/entity-status-banner";
import { shouldSuppressConnectPendingEntityBanner } from "@/lib/connect/should-suppress-connect-pending-entity-banner";
import { isDashboardListRoute, isDashboardOrgDetailRoute } from "@/lib/dashboard/list-routes";
import { cn } from "@auction/ui";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
} from "@auction/ui/components/bottom-sheet";
import { Button } from "@auction/ui/components/button";
import { BellRing } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

export function DashboardBannerStackClient(props: DashboardBannerStackProps) {
  const pathname = usePathname();
  const compact = isDashboardListRoute(pathname);
  const suppressOrgStatus = isDashboardOrgDetailRoute(pathname);
  const [alertsOpen, setAlertsOpen] = useState(false);

  const suppressKyc =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/verify-identity");

  const suppressConnectPending = shouldSuppressConnectPendingEntityBanner(pathname);

  const stackProps = useMemo(
    (): DashboardBannerStackProps => ({
      ...props,
      suppressOrgStatusBanner: suppressOrgStatus,
      suppressKycOnOverview: suppressKyc,
      suppressConnectPendingEntityBanner: suppressConnectPending,
    }),
    [props, suppressOrgStatus, suppressKyc, suppressConnectPending],
  );

  const alertCount = useMemo(() => countBannerCandidates(stackProps), [stackProps]);

  if (!compact) {
    return <DashboardBannerStack {...stackProps} maxVisible={2} compactOverflow={false} />;
  }

  if (alertCount === 0) return null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => setAlertsOpen(true)}
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning-container/20 px-4 py-2 text-left transition-colors hover:bg-warning-container/30",
        )}
        aria-label={`View ${alertCount} account alert${alertCount === 1 ? "" : "s"}`}
        data-testid="dashboard-alerts-preview"
      >
        <span className="flex min-w-0 items-center gap-2">
          <BellRing className="size-4 shrink-0 text-warning" aria-hidden />
          <span className="font-body text-sm text-on-surface">
            {alertCount} account alert{alertCount === 1 ? "" : "s"}
          </span>
        </span>
        <span className="shrink-0 font-label text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
          View
        </span>
      </Button>
      <BottomSheet open={alertsOpen} onOpenChange={setAlertsOpen}>
        <BottomSheetContent className="border-outline-variant bg-surface-container-lowest">
          <BottomSheetHeader className="px-6 pt-2 pb-1 text-left">
            <BottomSheetTitle className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              Account alerts
            </BottomSheetTitle>
          </BottomSheetHeader>
          <div className="space-y-4 px-6 pt-2 pb-6">
            <DashboardBannerStack {...stackProps} maxVisible={99} compactOverflow={false} />
          </div>
        </BottomSheetContent>
      </BottomSheet>
    </>
  );
}

function countBannerCandidates(props: DashboardBannerStackProps): number {
  let count = 0;
  if (props.kycSummary?.requiresKyc && !props.suppressKycOnOverview) count += 1;
  if (props.orgModuleEnabled && props.orgOnboardingResume) count += 1;
  if (
    props.orgModuleEnabled &&
    !props.suppressOrgStatusBanner &&
    isEntityStatusBannerVisible(props.acting)
  ) {
    count += 1;
  }
  if (
    props.user.emailStatus === "bounced" ||
    props.user.emailStatus === "complained" ||
    props.user.emailVerified === false
  ) {
    count += 1;
  }
  return count;
}
