import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { ActionRequiredBanner } from "@/components/dashboard/overview/action-required-banner";
import { ActiveBidsCard } from "@/components/dashboard/overview/active-bids-card";
import { DashboardOverviewLayout } from "@/components/dashboard/overview/dashboard-overview-layout";
import { OverviewErrorsAlert } from "@/components/dashboard/overview/overview-errors-alert";
import {
  buildOverviewDescription,
  buildOverviewKpiTiles,
} from "@/components/dashboard/overview/overview-presenters";
import { SecondaryActionStack } from "@/components/dashboard/overview/secondary-action-stack";
import { WatchlistPreviewCard } from "@/components/dashboard/overview/watchlist-preview-card";
import type { DashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import { Button } from "@auction/ui/components/button";
import { PageHeader } from "@auction/ui/components/page-header";
import Link from "next/link";

type Props = {
  vm: DashboardOverviewVm;
  /** When false, hides v2-only blocks (rollback via `NEXT_PUBLIC_DASHBOARD_V2`). */
  featureV2?: boolean;
};

export function DashboardOverviewView({ vm, featureV2 = true }: Props) {
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
          kpis: <KpiGrid tiles={buildOverviewKpiTiles(vm)} />,
          activity: <ActiveBidsCard vm={vm} />,
          banner: <ActionRequiredBanner row={vm.settlementsDue[0]} />,
          watchlist: <WatchlistPreviewCard vm={vm} variant="tile-grid" />,
          secondary: <SecondaryActionStack vm={vm} featureV2={featureV2} />,
        }}
      />
    </>
  );
}
