import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { applyFlatKpiTrendOverlay } from "@/lib/admin/apply-flat-kpi-trend-overlay";
import { applyKpiTrendOverlay } from "@/lib/admin/apply-kpi-trend-overlay";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import { mergeSaleOverviewAttentionRows } from "@/lib/admin/detail-board/merge-sale-overview-attention";
import type {
  DetailAttentionRow,
  DetailAttentionSeverity,
  DetailBoardKpiTile,
  DetailStatRow,
} from "@/lib/admin/detail-board/types";
import {
  adminDateStatExtras,
  formatAdminTableDateTime,
} from "@/lib/admin/format-admin-table-datetime";
import { saleDetailTabHref } from "@/lib/admin/sales/sale-detail-routes";
import type { AdminSaleAttention } from "@/lib/data/http/admin-sale-attention.server";
import type { AdminSaleDetailMetrics } from "@/lib/data/http/admin-sale-detail-metrics.server";
import type { AdminSaleOverviewKpiTrends } from "@/lib/data/http/admin-sale-overview-kpi-trends.server";
import { formatMoney } from "@/lib/ui/format";
import type { Lot, Sale, SaleDeliveryMode } from "@auction/types";
import { saleModeBidChannels } from "@auction/validators";

export type SaleOverviewViewModel = {
  kpiTiles: DetailBoardKpiTile[];
  attentionRows: DetailAttentionRow[];
  bidActivityRows: DetailStatRow[];
  auditRows: DetailStatRow[];
};

const BID_ACTIVITY_CHANNEL_DEFS = [
  {
    id: "online",
    label: "Online bids",
    channelKey: "online" as const,
    metric: (m: AdminSaleDetailMetrics) => m.bidActivityOnline,
  },
  {
    id: "room",
    label: "Room bids",
    channelKey: "room" as const,
    metric: (m: AdminSaleDetailMetrics) => m.bidActivityRoom,
  },
  {
    id: "phone",
    label: "Phone lines",
    channelKey: "phone" as const,
    metric: (m: AdminSaleDetailMetrics) => m.bidActivityPhone,
  },
] as const;

export function buildSaleBidActivityRows(
  deliveryMode: SaleDeliveryMode,
  metrics: AdminSaleDetailMetrics | null,
): DetailStatRow[] {
  const channels = saleModeBidChannels(deliveryMode);

  return BID_ACTIVITY_CHANNEL_DEFS.filter((def) => {
    if (channels[def.channelKey]) return true;
    const count = metrics ? def.metric(metrics) : null;
    return count != null && count > 0;
  }).map((def) => ({
    id: def.id,
    label: def.label,
    value: metrics && def.metric(metrics) != null ? String(def.metric(metrics)) : "—",
  }));
}

function publishedLotCount(lots: Lot[]): number {
  return lots.filter((l) => l.status !== "draft").length;
}

function readinessSeverity(severity: "required" | "warning"): DetailAttentionSeverity {
  return severity === "required" ? "critical" : "high";
}

function withTrendOverlay(
  tile: DetailBoardKpiTile,
  trends: AdminSaleOverviewKpiTrends | null | undefined,
  key: keyof AdminSaleOverviewKpiTrends,
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

export type SaleOverviewAttentionInput = {
  saleId: string;
  readiness: CatalogReadinessResult | null;
  deleteBlockers?: readonly string[];
  pendingRegistrationCount?: number | null;
  attention?: AdminSaleAttention | null;
};

export function buildSaleOverviewAttentionRows(
  input: SaleOverviewAttentionInput,
): DetailAttentionRow[] {
  const {
    saleId,
    readiness,
    deleteBlockers = [],
    pendingRegistrationCount = null,
    attention = null,
  } = input;

  const attentionFromReadiness: DetailAttentionRow[] =
    readiness?.items
      .filter((item) => !item.ok)
      .map((item) => ({
        id: item.id,
        title: item.label,
        count: 1,
        category: "Setup",
        severity: readinessSeverity(item.severity),
        actionLabel: "Review",
        iconKind: "setup" as const,
        ...(item.href ? { href: item.href } : {}),
      })) ?? [];

  const attentionFromBlockers: DetailAttentionRow[] = deleteBlockers.map((blocker, index) => ({
    id: `blocker-${index}`,
    title: blocker,
    count: 1,
    category: "Delete",
    severity: "high" as const,
    actionLabel: "Review",
    iconKind: "delete" as const,
    href: saleDetailTabHref(saleId, "overview"),
  }));

  const attentionFromPendingRegs: DetailAttentionRow[] =
    pendingRegistrationCount != null && pendingRegistrationCount > 0
      ? [
          {
            id: "pending-regs",
            title: "Pending bidder approvals",
            count: pendingRegistrationCount,
            category: "Bidders",
            severity: "critical",
            actionLabel: "Review registrations",
            iconKind: "registrations",
            href: saleDetailTabHref(saleId, "registrations"),
          },
        ]
      : [];

  return mergeSaleOverviewAttentionRows(saleId, {
    fromReadiness: attentionFromReadiness,
    fromBlockers: attentionFromBlockers,
    fromPendingRegs: attentionFromPendingRegs,
    fromApi: attention,
  });
}

export function buildSaleOverviewViewModel(input: {
  saleId: string;
  sale: Sale;
  lots: Lot[];
  registrationCount: number | null;
  readiness: CatalogReadinessResult | null;
  deleteBlockers?: readonly string[];
  metrics?: AdminSaleDetailMetrics | null;
  pendingRegistrationCount?: number | null;
  attention?: AdminSaleAttention | null;
  trends?: AdminSaleOverviewKpiTrends | null;
  periodDays?: AdminKpiPeriodDays;
}): SaleOverviewViewModel {
  const {
    saleId,
    sale,
    lots,
    registrationCount,
    readiness,
    deleteBlockers = [],
    pendingRegistrationCount = null,
    attention = null,
    trends = null,
  } = input;
  const metrics = input.metrics ?? null;
  const periodDays = input.periodDays ?? 30;
  const published = metrics?.publishedLotCount ?? publishedLotCount(lots);
  const lotTotal = metrics?.lotCount ?? lots.length;

  const hammerDisplay = metrics?.totalHammer != null ? formatMoney(metrics.totalHammer) : "—";

  const kpiTiles: DetailBoardKpiTile[] = [
    withTrendOverlay(
      {
        id: "lots",
        label: "Lots",
        value: String(lotTotal),
        compareHint: `${published} published`,
        trendTone: "info",
      },
      trends,
      "lots",
      periodDays,
    ),
    withTrendOverlay(
      {
        id: "estimate",
        label: "Aggregate estimate",
        value: metrics?.aggregateEstimate ? formatMoney(metrics.aggregateEstimate) : "—",
        compareHint: metrics?.aggregateEstimateDeltaHint ?? "Pending metrics",
        trendTone: "muted",
      },
      trends,
      "estimate",
      periodDays,
    ),
    withTrendOverlay(
      {
        id: "hammer",
        label: "Total hammer value",
        value: hammerDisplay,
        compareHint: "Sum of lot current prices",
        trendTone: "accent-gold",
      },
      trends,
      "hammer",
      periodDays,
    ),
    withTrendOverlay(
      {
        id: "revenue",
        label: "Expected revenue",
        value: metrics?.expectedRevenue ? formatMoney(metrics.expectedRevenue) : "—",
        compareHint: metrics?.expectedRevenueHint ?? "Incl. buyer's premium",
        trendTone: "success",
      },
      trends,
      "revenue",
      periodDays,
    ),
    withTrendOverlay(
      {
        id: "registrations",
        label: "Registrations",
        value: registrationCount != null ? String(registrationCount) : "—",
        compareHint:
          registrationCount != null && registrationCount > 0 ? "On file" : "No registrations yet",
        trendTone: "info",
      },
      trends,
      "registrations",
      periodDays,
    ),
    withTrendOverlay(
      {
        id: "bidders",
        label: "Active bidders",
        value: metrics?.activeBidders != null ? String(metrics.activeBidders) : "—",
        compareHint: metrics?.activeBiddersHint ?? "Bidding in session",
        trendTone: "accent-gold",
      },
      trends,
      "bidders",
      periodDays,
    ),
  ];

  const attentionRows = buildSaleOverviewAttentionRows({
    saleId,
    readiness,
    deleteBlockers,
    pendingRegistrationCount,
    attention,
  });

  const bidActivityRows = buildSaleBidActivityRows(sale.deliveryMode, metrics);

  const auditRows: DetailStatRow[] = [
    {
      id: "sync",
      label: "Last catalogue sync",
      value: metrics?.lastCatalogueSyncLabel ?? "—",
    },
    {
      id: "export",
      label: "Last export",
      value: metrics?.lastExportLabel ?? "—",
    },
    {
      id: "status",
      label: "Last status change",
      value:
        metrics?.lastStatusChangeLabel ??
        formatAdminTableDateTime(sale.updatedAt, "timestamp").primary,
      ...(!metrics?.lastStatusChangeLabel ? adminDateStatExtras(sale.updatedAt, "timestamp") : {}),
    },
  ];

  return {
    kpiTiles,
    attentionRows,
    bidActivityRows,
    auditRows,
  };
}
