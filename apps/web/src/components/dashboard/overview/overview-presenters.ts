import type { DashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
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
  const hammer = Number.parseFloat(row.lot.currentPrice);
  const premiumRate = Number.parseFloat(row.lot.buyerPremiumRate);
  if (!Number.isFinite(hammer)) return formatMoney(row.lot.currentPrice);
  const premium = Number.isFinite(premiumRate) ? hammer * premiumRate : 0;
  return formatMoney((hammer + premium).toFixed(2));
}

export function settlementStageIndex(row: SettlementRow): number {
  const label = portfolioSettlementLabel(row);
  if (label === "Paid" || label === "Payment authorized") return 2;
  if (label.includes("Refund")) return 0;
  return 1;
}

export function buildOverviewKpiTiles(vm: DashboardOverviewVm): KpiTileProps[] {
  return [
    {
      label: "Active bids",
      value: String(vm.kpi.activeBidsCount),
      delta: vm.kpi.activeBidsCount > 0 ? "Live positions" : "Ready to bid",
      deltaTone: vm.kpi.activeBidsCount > 0 ? "positive" : "neutral",
      trend: vm.kpi.trend,
      trendTone: "primary",
      emphasize: true,
    },
    {
      label: "Won lots",
      value: String(vm.acquiredCount),
      delta: `${vm.kpi.wonThisYear} this year`,
      trend: vm.kpi.trend,
      trendTone: "lot-orange",
    },
    {
      label: "Watchlist",
      value: String(vm.watchPreview.length),
      delta: "Saved lots",
      trend: vm.kpi.trend,
      trendTone: "secondary",
    },
    {
      label: "Submissions",
      value: vm.primaryCta?.href.includes("/submissions") ? "Start" : "Open",
      delta: "Specialist review",
      trend: vm.kpi.trend,
      trendTone: "primary",
    },
  ];
}

export function buildOverviewDescription(vm: DashboardOverviewVm): string {
  const acquiredSuffix = vm.acquiredCount === 1 ? "" : "s";
  const bidSuffix = vm.kpi.activeBidsCount === 1 ? "" : "s";
  return `${vm.liveCount} live lots · ${vm.acquiredCount} acquired work${acquiredSuffix} · ${vm.kpi.activeBidsCount} active bid${bidSuffix}.`;
}
