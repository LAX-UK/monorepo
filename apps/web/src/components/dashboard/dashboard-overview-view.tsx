import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { ActionRequiredBanner } from "@/components/dashboard/overview/action-required-banner";
import { ActiveBidsCard } from "@/components/dashboard/overview/active-bids-card";
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
    <div className="screen flex w-full flex-col gap-7">
      <OverviewErrorsAlert errors={vm.errors} />

      <PageHeader
        className="mb-0"
        title={`Welcome back, ${vm.firstName}`}
        description={buildOverviewDescription(vm)}
        actions={
          <Button asChild>
            <Link href={vm.primaryCta?.href ?? "/search"}>
              {vm.primaryCta?.label ?? "Browse auctions"}
            </Link>
          </Button>
        }
      />

      <KpiGrid tiles={buildOverviewKpiTiles(vm)} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <ActiveBidsCard vm={vm} />
        <WatchlistPreviewCard vm={vm} />
      </div>

      <ActionRequiredBanner row={vm.settlementsDue[0]} />

      <SecondaryActionStack vm={vm} featureV2={featureV2} />
    </div>
  );
}
