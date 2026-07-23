"use client";

import { CatalogDetailTabCard } from "@/components/admin/catalog";
import { CatalogDeleteEligibilityNotice } from "@/components/admin/catalog/catalog-delete-eligibility-notice";
import { CatalogKpiPeriodToggle } from "@/components/admin/catalog/catalog-kpi-period-toggle";
import {
  DetailActivityPreviewSection,
  DetailAttentionTable,
  DetailBoardKpiStrip,
  DetailEntityTable,
  DetailStatValue,
} from "@/components/admin/catalog/detail-board";
import { useSaleDetailReadiness } from "@/components/admin/sale-detail/sale-detail-readiness-context";
import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import type { ConnectRequiredByLotId } from "@/lib/admin/connect-readiness";
import { useSaleAttentionDismiss } from "@/lib/admin/detail-board/use-sale-attention-dismiss";
import { saleSetupResumeHref } from "@/lib/admin/sale-setup";
import type { AdminSaleAttention } from "@/lib/data/http/admin-sale-attention.server";
import type { AdminSaleDetailMetrics } from "@/lib/data/http/admin-sale-detail-metrics.server";
import type { AdminSaleOverviewKpiTrends } from "@/lib/data/http/admin-sale-overview-kpi-trends.server";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import { buildSaleOverviewViewModel } from "@/lib/data/view-models/sale-overview.vm";
import type { Lot, Sale } from "@auction/types";
import Link from "next/link";
import { Suspense, useMemo } from "react";

type Props = {
  saleId: string;
  sale: Sale;
  lots: Lot[];
  registrationCount: number | null;
  pendingRegistrationCount?: number | null;
  connectRequiredByLotId?: ConnectRequiredByLotId;
  activityEvents?: readonly AdminDomainEventRow[];
  metrics?: AdminSaleDetailMetrics | null;
  attention?: AdminSaleAttention | null;
  kpiTrends?: AdminSaleOverviewKpiTrends | null;
  kpiPeriodDays?: AdminKpiPeriodDays;
};

export function SaleOverviewTab({
  saleId,
  sale,
  lots,
  registrationCount,
  pendingRegistrationCount = null,
  connectRequiredByLotId,
  activityEvents = [],
  metrics = null,
  attention = null,
  kpiTrends = null,
  kpiPeriodDays = 30,
}: Props) {
  const { dismissAll, filterRows } = useSaleAttentionDismiss(saleId);
  const readinessContext = useSaleDetailReadiness();
  const readiness: CatalogReadinessResult | null =
    sale.status === "draft" ? (readinessContext?.draftSetupReadiness ?? null) : null;

  const showContinueSetup = sale.status === "draft" && readiness && readiness.percent < 100;
  const showDeleteBlockers =
    readinessContext?.canManageSales &&
    (sale.status === "draft" || sale.status === "scheduled") &&
    (readinessContext.deleteBlockers?.length ?? 0) > 0;

  const vm = buildSaleOverviewViewModel({
    saleId,
    sale,
    lots,
    registrationCount,
    pendingRegistrationCount,
    readiness,
    deleteBlockers: readinessContext?.deleteBlockers ?? [],
    metrics,
    attention,
    trends: kpiTrends,
    periodDays: kpiPeriodDays,
  });

  const visibleAttentionRows = useMemo(
    () => filterRows(vm.attentionRows),
    [filterRows, vm.attentionRows],
  );

  const activityPreview = (
    <DetailActivityPreviewSection
      events={activityEvents}
      exportFilters={{ aggregateType: "sale", aggregateId: saleId }}
      emptyMessage="No sale activity recorded yet. Events appear when the sale is published, cancelled, or ended."
      viewAllHref={`/admin/sales/${saleId}/activity`}
    />
  );

  return (
    <div className="space-y-6">
      {showDeleteBlockers ? (
        <CatalogDeleteEligibilityNotice
          blockers={readinessContext?.deleteBlockers ?? []}
          entityLabel="sale"
        />
      ) : null}
      {showContinueSetup ? (
        <Link
          href={saleSetupResumeHref(saleId, {
            sale,
            lots,
            pendingRegistrationCount,
            ...(connectRequiredByLotId ? { connectRequiredByLotId } : {}),
          })}
          className="block rounded-shell-card border border-secondary/30 bg-secondary/5 p-5 transition-colors hover:bg-secondary/10"
        >
          <h3 className="font-headline text-base text-on-surface">Continue sale setup</h3>
          <p className="mt-2 font-body text-sm text-on-surface-variant">
            {readiness?.completeCount ?? 0} of {readiness?.totalCount ?? 0} checks complete — finish
            setup to publish.
          </p>
          <span className="mt-3 inline-block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Continue setup →
          </span>
        </Link>
      ) : null}

      <DetailBoardKpiStrip
        ariaLabel="Sale overview"
        tiles={vm.kpiTiles}
        toolbarEnd={
          <Suspense fallback={null}>
            <CatalogKpiPeriodToggle current={kpiPeriodDays} />
          </Suspense>
        }
      />

      <DetailAttentionTable
        rows={visibleAttentionRows}
        {...(visibleAttentionRows.length > 0
          ? {
              onDismissAll: () => dismissAll(visibleAttentionRows.map((row) => row.id)),
            }
          : {})}
      />

      {activityPreview}

      <CatalogDetailTabCard
        title="Bid activity"
        description="Bids placed across channels for this sale."
      >
        <DetailEntityTable
          rows={vm.bidActivityRows}
          getRowId={(row) => row.id}
          emptyTitle="No bid activity yet"
          columns={[
            {
              id: "channel",
              header: "Channel",
              cell: (row) => <span className="font-body text-sm text-on-surface">{row.label}</span>,
            },
            {
              id: "count",
              header: "Bids",
              headerClassName: "text-right",
              className: "text-right",
              cell: (row) => (
                <span className="font-headline text-sm font-semibold tabular-nums text-on-surface">
                  {row.value}
                </span>
              ),
            },
          ]}
        />
      </CatalogDetailTabCard>

      <CatalogDetailTabCard
        title="Audit log"
        description="Catalogue sync, exports, and status changes."
      >
        <DetailEntityTable
          rows={vm.auditRows}
          getRowId={(row) => row.id}
          emptyTitle="No audit events recorded"
          columns={[
            {
              id: "event",
              header: "Event",
              cell: (row) => <span className="font-body text-sm text-on-surface">{row.label}</span>,
            },
            {
              id: "when",
              header: "When",
              headerClassName: "text-right",
              className: "text-right",
              cell: (row) => (
                <DetailStatValue row={row} className="font-body text-sm text-on-surface-variant" />
              ),
            },
          ]}
        />
      </CatalogDetailTabCard>
    </div>
  );
}
