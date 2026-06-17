import type { KpiRowTile } from "@/components/dashboard/primitives/kpi-row";
import { kpiCompareHint } from "@/lib/dashboard/kpi-slot-conventions";
import type { DashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import { lotTotalMajorUnits } from "@/lib/data/view-models/lot-pricing-helpers";
import { formatMoney, resolveLotCurrency } from "@/lib/format-currency";
import { portfolioSettlementLabel } from "@/lib/portfolio-settlement";
import type { ClientWorkspaceMode } from "@/lib/workspace/client-workspace-mode";

export type SettlementRow = DashboardOverviewVm["settlementsDue"][number];

export type AccountEssentialLink = {
  label: string;
  href: string;
};

export const accountEssentialLinks: readonly AccountEssentialLink[] = [
  { label: "Profile", href: "/dashboard/settings/profile" },
  { label: "Notifications", href: "/dashboard/settings/notifications" },
  { label: "Bidding", href: "/dashboard/settings/bidding" },
  { label: "Artists", href: "/dashboard/watchlist?section=artists" },
];

export function formatSettlementTotal(row: SettlementRow): string {
  return formatMoney(lotTotalMajorUnits(row.lot).toFixed(2), resolveLotCurrency(row.lot));
}

export function settlementStageIndex(row: SettlementRow): number {
  const label = portfolioSettlementLabel(row);
  if (label === "Paid" || label === "Payment authorized") return 2;
  if (label.includes("Refund")) return 0;
  return 1;
}

export function buildOverviewKpiTiles(vm: DashboardOverviewVm): KpiRowTile[] {
  const activeBidsDelta = (() => {
    if (vm.outbidCount > 0) return `${vm.outbidCount} outbid`;
    if (vm.kpi.activeBidsCount > 0) return "Leading";
    return "Ready";
  })();
  const activeBidsCompareHint = (() => {
    if (vm.outbidCount > 0) return "Needs attention";
    if (vm.kpi.activeBidsCount > 0) return "All positions leading";
    return "Ready to bid";
  })();
  const activeBidsTone: "positive" | "negative" | "neutral" =
    vm.outbidCount > 0 ? "negative" : vm.kpi.activeBidsCount > 0 ? "positive" : "neutral";

  const fourthTile: KpiRowTile =
    vm.acquiredCount > 0
      ? {
          label: "Portfolio value",
          value: vm.kpi.portfolioValueFormatted,
          delta:
            vm.kpi.winRatePercent != null
              ? `${vm.kpi.winRatePercent}% win rate`
              : vm.kpi.engagementLabel,
          ...(vm.kpi.winRatePercent != null ? kpiCompareHint("All time") : {}),
          deltaTone: "neutral",
        }
      : {
          label: "Submissions",
          value: vm.submissionsCount > 0 ? String(vm.submissionsCount) : "\u2014",
          delta: vm.submissionsCount > 0 ? "In review" : "Submit",
          ...kpiCompareHint(vm.submissionsCount > 0 ? "Specialist review" : "Submit an item"),
          deltaTone: "neutral",
        };

  return [
    {
      label: "Active bids",
      value: String(vm.kpi.activeBidsCount),
      delta: activeBidsDelta,
      ...kpiCompareHint(activeBidsCompareHint),
      deltaTone: activeBidsTone,
      emphasize: true,
      href: "/dashboard/bids",
    },
    {
      label: "Won lots",
      value: String(vm.acquiredCount),
      delta: vm.kpi.wonThisYear > 0 ? `${vm.kpi.wonThisYear} this year` : "All time",
      deltaTone: "neutral",
      href: "/dashboard/portfolio",
    },
    {
      label: "Watchlist",
      value: String(vm.watchlistTotalCount),
      delta:
        vm.endingSoonWatchlist.length > 0
          ? `${vm.endingSoonWatchlist.length} ending soon`
          : "Saved lots",
      deltaTone: vm.endingSoonWatchlist.length > 0 ? "positive" : "neutral",
      href: "/dashboard/watchlist",
    },
    {
      ...fourthTile,
      href:
        vm.acquiredCount > 0
          ? "/dashboard/portfolio"
          : vm.submissionsCount > 0
            ? "/dashboard/submissions"
            : "/dashboard/submissions/new",
    },
  ];
}

export function buildOverviewDescription(
  vm: DashboardOverviewVm,
  mode: ClientWorkspaceMode = "buying",
): string {
  if (
    mode === "selling" &&
    vm.liveLotsPreviewCount === 0 &&
    vm.acquiredCount === 0 &&
    vm.kpi.activeBidsCount === 0
  ) {
    if (vm.submissionsCount > 0) {
      const suffix = vm.submissionsCount === 1 ? "" : "s";
      return `${vm.submissionsCount} submission${suffix} in your seller workspace.`;
    }
    return "Track submissions, active sales, and payouts from your seller workspace.";
  }

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
