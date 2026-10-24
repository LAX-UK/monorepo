"use client";

import { AuditTimeline } from "@/components/admin/audit/audit-timeline";
import { useLotDetailReadiness } from "@/components/admin/lot-detail/lot-detail-readiness-context";
import { lotDetailTabHref } from "@/components/admin/lot-detail/lot-detail-types";
import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import { lotEditResumeHref } from "@/lib/admin/catalog-readiness";
import type { LotDetailContext } from "@/lib/admin/lot-detail-context";
import type { AdminLotAttention } from "@/lib/data/http/admin-lot-attention.server";
import type { AdminLotDetailMetrics } from "@/lib/data/http/admin-lot-detail-metrics.server";
import type { AdminLotOverviewKpiTrends } from "@/lib/data/http/admin-lot-overview-kpi-trends.server";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import { buildLotOverviewViewModel } from "@/lib/data/view-models/lot-overview.vm";
import { KeyValueList, Section, StaffButton, StatGrid, StatusBadge } from "@auction/staff-ui";
import type { Lot } from "@auction/types";
import { Progress } from "@auction/ui/components/progress";
import { ArrowRight, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

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

const SEVERITY_TONE = {
  critical: "danger",
  high: "warning",
  medium: "warning",
  low: "neutral",
} as const;

/**
 * The lot at a glance: what still blocks it, its numbers, what it is and what happened. Work on
 * the left, reference on the right; every row reads as label and value.
 */
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
  const deleteBlockers =
    readinessContext?.canManageAuction &&
    (auction.status === "draft" || auction.status === "scheduled")
      ? (readinessContext.deleteBlockers ?? [])
      : [];

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

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex min-w-0 flex-col gap-6">
        {showContinueEditing && readiness ? (
          <Section
            title="Finish the draft"
            description={`${readiness.completeCount} of ${readiness.totalCount} publish checks complete`}
            action={
              <StaffButton asChild size="sm" variant="primary" icon={<ArrowRight aria-hidden />}>
                <Link href={lotEditResumeHref(lotId, readiness)}>Continue editing</Link>
              </StaffButton>
            }
          >
            <Progress
              value={readiness.percent}
              aria-label="Publish checks complete"
              className="h-1.5 bg-staff-neutral-bg [&>div]:bg-staff-ink"
            />
          </Section>
        ) : null}

        <StatGrid
          label="Lot numbers"
          items={vm.kpiTiles.slice(0, 4).map((tile) => ({
            id: tile.id,
            label: tile.label,
            value: tile.value,
            ...(tile.compareHint || tile.deltaPercent
              ? {
                  hint: [tile.deltaPercent, tile.compareHint].filter(Boolean).join(" "),
                  hintTone:
                    tile.deltaDirection === "up"
                      ? ("positive" as const)
                      : tile.deltaDirection === "down"
                        ? ("negative" as const)
                        : ("neutral" as const),
                }
              : {}),
          }))}
        />

        {vm.attentionRows.length > 0 || deleteBlockers.length > 0 ? (
          <Section title="Needs attention" bodyClassName="p-0">
            <ul className="divide-y divide-staff-line-subtle">
              {vm.attentionRows.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <TriangleAlert aria-hidden className="size-4 shrink-0 text-staff-warning-dot" />
                    <span className="truncate text-staff-sm text-staff-fg">{row.title}</span>
                    <StatusBadge
                      tone={SEVERITY_TONE[row.severity as keyof typeof SEVERITY_TONE] ?? "neutral"}
                    >
                      {row.category}
                    </StatusBadge>
                  </span>
                  {row.href ? (
                    <StaffButton asChild size="sm" variant="ghost">
                      <Link href={row.href}>{row.actionLabel}</Link>
                    </StaffButton>
                  ) : null}
                </li>
              ))}
              {deleteBlockers.map((blocker) => (
                <li key={blocker} className="px-4 py-3 text-staff-sm text-staff-muted">
                  Cannot be deleted: {blocker}
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section title="Commercial" description="Pricing and schedule">
          <KeyValueList
            items={vm.commercialRows.map((row) => ({ label: row.label, value: row.value }))}
          />
        </Section>

        <Section id="catalogue" title="Catalogue" description="Description and physical details">
          <KeyValueList
            items={vm.catalogueRows.map((row) => ({ label: row.label, value: row.value }))}
          />
        </Section>
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <Section
          title="Images"
          action={
            <StaffButton asChild size="sm" variant="ghost">
              <Link href={lotDetailTabHref(lotId, "images")}>Manage</Link>
            </StaffButton>
          }
        >
          {auction.images.length > 0 ? (
            <ul className="grid grid-cols-2 gap-2">
              {auction.images.slice(0, 4).map((src, index) => (
                <li
                  key={src}
                  className="overflow-hidden rounded-staff-sm border border-staff-line bg-staff-sunken"
                >
                  <img
                    src={src}
                    alt={imageAlts[index] ?? `${auction.title}, image ${index + 1}`}
                    loading="lazy"
                    className="aspect-square w-full object-cover"
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-staff-sm text-staff-muted">
              No images yet. Add them before publishing.
            </p>
          )}
        </Section>

        <Section
          title="Activity"
          action={
            <StaffButton asChild size="sm" variant="ghost">
              <Link href={lotDetailTabHref(lotId, "activity")}>View all</Link>
            </StaffButton>
          }
        >
          <AuditTimeline
            label="Lot activity"
            empty="No lot activity recorded yet."
            events={activityEvents}
            limit={5}
          />
        </Section>

        <Section title="Record">
          <KeyValueList
            items={vm.auditRows
              .filter((row) => row.id !== "status")
              .map((row) => ({ label: row.label, value: row.value }))}
          />
        </Section>
      </div>
    </div>
  );
}
