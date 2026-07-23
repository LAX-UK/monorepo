import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { applyFlatKpiTrendOverlay } from "@/lib/admin/apply-flat-kpi-trend-overlay";
import { applyKpiTrendOverlay } from "@/lib/admin/apply-kpi-trend-overlay";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import { mapLotAttentionToRows } from "@/lib/admin/detail-board/map-lot-attention";
import type {
  DetailAttentionRow,
  DetailBoardKpiTile,
  DetailStatRow,
} from "@/lib/admin/detail-board/types";
import {
  adminDateStatExtras,
  formatAdminTableDateTime,
} from "@/lib/admin/format-admin-table-datetime";
import type { LotDetailContext } from "@/lib/admin/lot-detail-context";
import { formatLotEstimate, lotStatusLabel } from "@/lib/admin/lots/lot-catalog-presenters";
import { lotDetailTabHref } from "@/lib/admin/lots/lot-detail-routes";
import type { AdminLotAttention } from "@/lib/data/http/admin-lot-attention.server";
import type { AdminLotDetailMetrics } from "@/lib/data/http/admin-lot-detail-metrics.server";
import type { AdminLotOverviewKpiTrends } from "@/lib/data/http/admin-lot-overview-kpi-trends.server";
import { lotAuctionTypeLabel } from "@/lib/presenters/lot-auction-type-presentation";
import { formatMoney, formatPercent } from "@/lib/ui/format";
import type { Lot } from "@auction/types";

export type LotOverviewViewModel = {
  kpiTiles: DetailBoardKpiTile[];
  attentionRows: DetailAttentionRow[];
  commercialRows: DetailStatRow[];
  catalogueRows: DetailStatRow[];
  auditRows: DetailStatRow[];
};

function withTrendOverlay(
  tile: DetailBoardKpiTile,
  trends: AdminLotOverviewKpiTrends | null | undefined,
  key: keyof AdminLotOverviewKpiTrends,
  periodDays: AdminKpiPeriodDays,
): DetailBoardKpiTile {
  const bundle = trends?.[key];
  if (!bundle || bundle.dailyCounts.length === 0) {
    const numeric = Number.parseFloat(String(tile.value).replace(/[^\d.-]/g, ""));
    const snapshot = Number.isFinite(numeric) ? numeric : 0;
    return { ...tile, ...applyFlatKpiTrendOverlay(snapshot, periodDays) };
  }
  return { ...tile, ...applyKpiTrendOverlay(bundle, periodDays) };
}

function readinessSeverity(severity: "required" | "warning"): DetailAttentionRow["severity"] {
  return severity === "required" ? "critical" : "high";
}

export function buildLotOverviewViewModel(input: {
  lotId: string;
  auction: Lot;
  context: LotDetailContext;
  bidCount: number | null;
  readiness?: CatalogReadinessResult | null;
  deleteBlockers?: readonly string[];
  metrics?: AdminLotDetailMetrics | null;
  attention?: AdminLotAttention | null;
  trends?: AdminLotOverviewKpiTrends | null;
  periodDays?: AdminKpiPeriodDays;
}): LotOverviewViewModel {
  const {
    lotId,
    auction,
    context,
    bidCount,
    readiness = null,
    deleteBlockers = [],
    attention = null,
    trends = null,
  } = input;
  const metrics = input.metrics ?? null;
  const periodDays = input.periodDays ?? 30;

  const premiumLabel =
    metrics?.buyerPremiumLabel ??
    (() => {
      const premiumPct = Number.parseFloat(auction.buyerPremiumRate);
      return Number.isNaN(premiumPct) ? auction.buyerPremiumRate : formatPercent(premiumPct * 100);
    })();

  const estimateValue = formatLotEstimate(auction);
  const reserveValue = auction.reservePrice
    ? formatMoney(auction.reservePrice)
    : metrics?.reservePrice
      ? formatMoney(metrics.reservePrice)
      : "No reserve";
  const currentBidValue = metrics?.currentHammer
    ? formatMoney(metrics.currentHammer)
    : formatMoney(auction.currentPrice);

  const kpiTiles: DetailBoardKpiTile[] = [
    withTrendOverlay(
      {
        id: "estimate",
        label: "Estimate",
        value: estimateValue,
        compareHint: "Pre-sale range",
        trendTone: "muted",
      },
      trends,
      "hammer",
      periodDays,
    ),
    withTrendOverlay(
      {
        id: "reserve",
        label: "Reserve",
        value: reserveValue,
        compareHint:
          metrics?.reserveMet === true
            ? "Reserve met"
            : metrics?.reserveMet === false
              ? "Below reserve"
              : auction.reservePrice
                ? "On file"
                : "No reserve",
        trendTone: metrics?.reserveMet === true ? "success" : "secondary",
      },
      trends,
      "hammer",
      periodDays,
    ),
    withTrendOverlay(
      {
        id: "current-bid",
        label: "Current bid",
        value: currentBidValue,
        compareHint: `${metrics?.bidCount ?? bidCount ?? 0} bids`,
        trendTone: "accent-gold",
      },
      trends,
      "hammer",
      periodDays,
    ),
    withTrendOverlay(
      {
        id: "bidders",
        label: "Bidders",
        value: String(metrics?.uniqueBidders ?? 0),
        compareHint: "Unique on this lot",
        trendTone: "info",
      },
      trends,
      "bidders",
      periodDays,
    ),
    withTrendOverlay(
      {
        id: "views",
        label: "Views",
        value: metrics?.pageViewCount != null ? String(metrics.pageViewCount) : "—",
        compareHint: metrics?.pageViewCount != null ? "Page views" : "Analytics pending",
        trendTone: "muted",
      },
      trends,
      "bidders",
      periodDays,
    ),
    withTrendOverlay(
      {
        id: "buyer-premium",
        label: "Buyer premium",
        value: premiumLabel ?? "—",
        compareHint: "Buyer premium rate",
        trendTone: "secondary",
      },
      trends,
      "hammer",
      periodDays,
    ),
  ];

  const attentionFromReadiness: DetailAttentionRow[] =
    readiness && readiness.percent < 100
      ? readiness.items
          .filter((c) => !c.ok)
          .map((check) => ({
            id: `readiness-${check.id}`,
            title: check.label,
            count: 1,
            category: "Setup",
            severity: readinessSeverity(check.severity),
            actionLabel: "Continue editing",
            iconKind: "setup" as const,
            href: lotDetailTabHref(lotId, check.id === "images" ? "images" : "overview"),
          }))
      : [];

  const attentionFromDelete: DetailAttentionRow[] = deleteBlockers.map((blocker, i) => ({
    id: `delete-blocker-${i}`,
    title: blocker,
    count: 1,
    category: "Operations",
    severity: "critical" as const,
    actionLabel: "Review",
    iconKind: "delete" as const,
  }));

  const attentionRows = [
    ...attentionFromDelete,
    ...attentionFromReadiness,
    ...(attention ? mapLotAttentionToRows(lotId, attention) : []),
  ];

  const commercialRows: DetailStatRow[] = [
    { id: "starting", label: "Starting price", value: formatMoney(auction.startingPrice) },
    {
      id: "reserve",
      label: "Reserve",
      value: auction.reservePrice ? formatMoney(auction.reservePrice) : "No reserve",
    },
    { id: "hammer", label: "Current hammer", value: formatMoney(auction.currentPrice) },
    { id: "premium", label: "Buyer premium", value: premiumLabel },
    {
      id: "type",
      label: "Auction type",
      value: lotAuctionTypeLabel(auction.auctionType),
    },
    {
      id: "start",
      label: "Start",
      value: formatAdminTableDateTime(auction.startTime, "deadline", { deadlineKind: "start" })
        .primary,
      ...adminDateStatExtras(auction.startTime, "deadline", { deadlineKind: "start" }),
    },
    {
      id: "end",
      label: "End",
      value: formatAdminTableDateTime(auction.endTime, "deadline").primary,
      ...adminDateStatExtras(auction.endTime, "deadline", { dateLive: true }),
    },
  ];

  const auditRows: DetailStatRow[] = [
    {
      id: "created",
      label: "Created",
      value: formatAdminTableDateTime(auction.createdAt, "timestamp").primary,
      ...adminDateStatExtras(auction.createdAt, "timestamp"),
    },
    {
      id: "updated",
      label: "Last catalogue update",
      value: formatAdminTableDateTime(auction.updatedAt, "timestamp").primary,
      ...adminDateStatExtras(auction.updatedAt, "timestamp"),
    },
    {
      id: "status",
      label: "Current status",
      value: lotStatusLabel(auction.status, auction.winnerId),
    },
    {
      id: "bids",
      label: "Bid activity",
      value: `${metrics?.bidCount ?? bidCount ?? 0} bids · ${metrics?.uniqueBidders ?? 0} bidders`,
    },
  ];

  const catalogueRows: DetailStatRow[] = [
    {
      id: "description",
      label: "Description",
      value: auction.description?.trim() || "No catalogue description yet.",
    },
    ...(auction.medium ? [{ id: "medium", label: "Medium", value: auction.medium }] : []),
    ...(auction.dimensions
      ? [{ id: "dimensions", label: "Dimensions", value: auction.dimensions }]
      : []),
    ...(context.categories.length > 0
      ? [
          {
            id: "categories",
            label: "Categories",
            value: context.categories.map((c) => c.name).join(", "),
          },
        ]
      : []),
    ...(context.sale ? [{ id: "sale", label: "Sale", value: context.sale.title }] : []),
    ...(context.artist
      ? [{ id: "artist", label: "Artist", value: context.artist.displayName }]
      : []),
  ];

  return {
    kpiTiles,
    attentionRows,
    commercialRows,
    catalogueRows,
    auditRows,
  };
}
