import type { DashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import { lotTotalMajorUnits } from "@/lib/data/view-models/lot-pricing-helpers";
import { formatMoney } from "@/lib/format-currency";
import { portfolioSettlementLabel } from "@/lib/portfolio-settlement";
import type { KpiTileProps } from "@auction/ui";

export type SettlementRow = DashboardOverviewVm["settlementsDue"][number];

export type AccountEssentialLink = {
  label: string;
  href: string;
};

export const accountEssentialLinks: readonly AccountEssentialLink[] = [
  { label: "Profile", href: "/dashboard/settings/profile" },
  { label: "Alerts", href: "/dashboard/settings/notifications" },
  { label: "Bidding", href: "/dashboard/settings/bidding" },
  { label: "Artists", href: "/dashboard/artist-follow" },
];

export function formatSettlementTotal(row: SettlementRow): string {
  return formatMoney(lotTotalMajorUnits(row.lot).toFixed(2));
}

export function settlementStageIndex(row: SettlementRow): number {
  const label = portfolioSettlementLabel(row);
  if (label === "Paid" || label === "Payment authorized") return 2;
  if (label.includes("Refund")) return 0;
  return 1;
}

export function buildOverviewKpiTiles(vm: DashboardOverviewVm): KpiTileProps[] {
  const activeBidsDelta = (() => {
    if (vm.outbidCount > 0) return `${vm.outbidCount} outbid \u2014 needs attention`;
    if (vm.kpi.activeBidsCount > 0) return "All positions still leading";
    return "Ready to bid";
  })();
  const activeBidsTone: "positive" | "negative" | "neutral" =
    vm.outbidCount > 0 ? "negative" : vm.kpi.activeBidsCount > 0 ? "positive" : "neutral";

  const fourthTile: KpiTileProps =
    vm.acquiredCount > 0
      ? {
          label: "Portfolio value",
          value: vm.kpi.portfolioValueFormatted,
          delta:
            vm.kpi.winRatePercent != null
              ? `Win rate ${vm.kpi.winRatePercent}%`
              : vm.kpi.engagementLabel,
          deltaTone: "neutral",
        }
      : {
          label: "Submissions",
          value: vm.submissionsCount > 0 ? String(vm.submissionsCount) : "\u2014",
          delta: vm.submissionsCount > 0 ? "Specialist review" : "Submit an item",
          deltaTone: "neutral",
        };

  return [
    {
      label: "Active bids",
      value: String(vm.kpi.activeBidsCount),
      delta: activeBidsDelta,
      deltaTone: activeBidsTone,
      emphasize: true,
    },
    {
      label: "Won lots",
      value: String(vm.acquiredCount),
      delta: vm.kpi.wonThisYear > 0 ? `${vm.kpi.wonThisYear} this year` : "All time",
      deltaTone: "neutral",
    },
    {
      label: "Watchlist",
      value: String(vm.watchlistTotalCount),
      delta:
        vm.endingSoonWatchlist.length > 0
          ? `${vm.endingSoonWatchlist.length} ending soon`
          : "Saved lots",
      deltaTone: vm.endingSoonWatchlist.length > 0 ? "positive" : "neutral",
    },
    fourthTile,
  ];
}

export function buildOverviewDescription(vm: DashboardOverviewVm): string {
  if (vm.liveLotsPreviewCount === 0 && vm.acquiredCount === 0 && vm.kpi.activeBidsCount === 0) {
    return "Here is your auction activity at a glance.";
  }
  const parts: string[] = [];
  if (vm.kpi.activeBidsCount > 0) {
    const bidSuffix = vm.kpi.activeBidsCount === 1 ? "" : "s";
    parts.push(`${vm.kpi.activeBidsCount} active bid${bidSuffix}`);
  }
  if (vm.acquiredCount > 0) {
    const acquiredSuffix = vm.acquiredCount === 1 ? "" : "s";
    parts.push(`${vm.acquiredCount} acquired work${acquiredSuffix}`);
  }
  if (vm.watchlistTotalCount > 0) {
    parts.push(`${vm.watchlistTotalCount} on watchlist`);
  }
  if (parts.length === 0) return "Here is your auction activity at a glance.";
  return `${parts.join(" \u00B7 ")}.`;
}
