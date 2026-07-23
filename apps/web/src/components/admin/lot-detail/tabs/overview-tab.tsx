"use client";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { CatalogDeleteEligibilityNotice } from "@/components/admin/catalog/catalog-delete-eligibility-notice";
import { CatalogDetailTabCard } from "@/components/admin/catalog/catalog-detail-tab-card";
import { CatalogKpiPeriodToggle } from "@/components/admin/catalog/catalog-kpi-period-toggle";
import {
  DetailActivityPreviewSection,
  DetailAttentionTable,
  DetailBoardKpiStrip,
  DetailCardGrid,
  DetailEntityTable,
  DetailStatValue,
} from "@/components/admin/catalog/detail-board";
import { LotAuctionTypeChip } from "@/components/admin/lot-auction-type-chip";
import { useLotDetailReadiness } from "@/components/admin/lot-detail/lot-detail-readiness-context";
import { lotDetailTabHref } from "@/components/admin/lot-detail/lot-detail-types";
import { MediaImage } from "@/components/ui/media-image";
import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import { lotEditResumeHref } from "@/lib/admin/catalog-readiness";
import type { LotDetailContext } from "@/lib/admin/lot-detail-context";
import type { AdminLotAttention } from "@/lib/data/http/admin-lot-attention.server";
import type { AdminLotDetailMetrics } from "@/lib/data/http/admin-lot-detail-metrics.server";
import type { AdminLotOverviewKpiTrends } from "@/lib/data/http/admin-lot-overview-kpi-trends.server";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import { buildLotOverviewViewModel } from "@/lib/data/view-models/lot-overview.vm";
import type { Lot } from "@auction/types";
import Link from "next/link";
import { Suspense, useMemo } from "react";

type Props = {
  lotId: string;
  auction: Lot;
  context: LotDetailContext;
  bidCount: number | null;
  activityEvents?: readonly AdminDomainEventRow[];
  metrics?: AdminLotDetailMetrics | null;
  attention?: AdminLotAttention | null;
  kpiTrends?: AdminLotOverviewKpiTrends | null;
  kpiPeriodDays?: AdminKpiPeriodDays;
};

export function LotOverviewTab({
  lotId,
  auction,
  context,
  bidCount,
  activityEvents = [],
  metrics = null,
  attention = null,
  kpiTrends = null,
  kpiPeriodDays = 30,
}: Props) {
  const readinessContext = useLotDetailReadiness();
  const readiness: CatalogReadinessResult | null = readinessContext?.publishReadiness ?? null;

  const showContinueEditing =
    auction.status === "draft" && readiness != null && readiness.percent < 100;
  const showDeleteBlockers =
    readinessContext?.canManageAuction &&
    (auction.status === "draft" || auction.status === "scheduled") &&
    (readinessContext.deleteBlockers?.length ?? 0) > 0;

  const vm = useMemo(
    () =>
      buildLotOverviewViewModel({
        lotId,
        auction,
        context,
        bidCount,
        readiness,
        deleteBlockers: readinessContext?.deleteBlockers ?? [],
        metrics,
        attention,
        trends: kpiTrends,
        periodDays: kpiPeriodDays,
      }),
    [
      lotId,
      auction,
      context,
      bidCount,
      readiness,
      readinessContext?.deleteBlockers,
      metrics,
      attention,
      kpiTrends,
      kpiPeriodDays,
    ],
  );

  const imageAlts = auction.marketingDetails.imageAlts ?? [];
  const artworkCards = auction.images.slice(0, 4).map((src, i) => ({
    id: `image-${i}`,
    title: imageAlts[i]?.trim() || `Image ${i + 1}`,
    subtitle: i === 0 ? "Primary" : undefined,
    image: (
      <MediaImage
        src={src}
        alt={imageAlts[i] ?? auction.title}
        label={`Lot image ${i + 1}`}
        imgClassName="object-cover"
        sizes="(max-width: 768px) 50vw, 25vw"
      />
    ),
    href: lotDetailTabHref(lotId, "images"),
  }));

  return (
    <div className="space-y-6">
      {showDeleteBlockers ? (
        <CatalogDeleteEligibilityNotice
          blockers={readinessContext?.deleteBlockers ?? []}
          entityLabel="lot"
        />
      ) : null}
      {showContinueEditing ? (
        <Link
          href={lotEditResumeHref(lotId, readiness)}
          className="block rounded-shell-card border border-primary/30 bg-primary/5 p-5 transition-colors hover:bg-primary/10"
        >
          <h3 className="font-headline text-base text-on-surface">Continue editing draft</h3>
          <p className="mt-2 font-body text-sm text-on-surface-variant">
            {readiness?.completeCount ?? 0} of {readiness?.totalCount ?? 0} publish checks complete
            — finish catalogue details before going live.
          </p>
          <span className="mt-3 inline-block font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Edit lot →
          </span>
        </Link>
      ) : null}

      <DetailBoardKpiStrip
        ariaLabel="Lot overview"
        tiles={vm.kpiTiles}
        toolbarEnd={
          <Suspense fallback={null}>
            <CatalogKpiPeriodToggle current={kpiPeriodDays} />
          </Suspense>
        }
      />

      {vm.attentionRows.length > 0 ? <DetailAttentionTable rows={vm.attentionRows} /> : null}

      <DetailActivityPreviewSection
        title="Recent activity"
        description="Timeline of changes and key events for this lot."
        events={activityEvents}
        exportFilters={{ aggregateType: "lot", aggregateId: lotId }}
        emptyMessage="No lot activity recorded yet."
        viewAllHref={lotDetailTabHref(lotId, "activity")}
      />

      <CatalogDetailTabCard title="Commercial" description="Pricing and schedule for this lot.">
        <DetailEntityTable
          rows={vm.commercialRows}
          getRowId={(row) => row.id}
          emptyTitle="No commercial details"
          columns={[
            {
              id: "field",
              header: "Field",
              cell: (row) => <span className="text-on-surface-variant">{row.label}</span>,
            },
            {
              id: "value",
              header: "Value",
              cell: (row) =>
                row.id === "type" ? (
                  <LotAuctionTypeChip auctionType={auction.auctionType} />
                ) : (
                  <DetailStatValue row={row} />
                ),
            },
          ]}
        />
      </CatalogDetailTabCard>

      {artworkCards.length > 0 ? (
        <CatalogDetailTabCard title="Artwork preview" description="Primary catalogue images.">
          <DetailCardGrid items={artworkCards} columns={4} />
        </CatalogDetailTabCard>
      ) : null}

      <CatalogDetailTabCard title="Audit log" description="Catalogue updates and bid activity.">
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
              cell: (row) =>
                row.id === "status" ? (
                  <AdminStatusBadge
                    domain="lot"
                    status={auction.status}
                    context={{ lot: { winnerId: auction.winnerId } }}
                  />
                ) : (
                  <DetailStatValue
                    row={row}
                    className="font-body text-sm text-on-surface-variant"
                  />
                ),
            },
          ]}
        />
      </CatalogDetailTabCard>

      <div id="catalogue">
        <CatalogDetailTabCard title="Catalogue" description="Description and physical details.">
          <DetailEntityTable
            rows={vm.catalogueRows}
            getRowId={(row) => row.id}
            emptyTitle="No catalogue details"
            columns={[
              {
                id: "field",
                header: "Field",
                cell: (row) => <span className="text-on-surface-variant">{row.label}</span>,
              },
              {
                id: "value",
                header: "Value",
                cell: (row) => <span className="text-on-surface">{row.value}</span>,
              },
            ]}
          />
        </CatalogDetailTabCard>
      </div>
    </div>
  );
}
