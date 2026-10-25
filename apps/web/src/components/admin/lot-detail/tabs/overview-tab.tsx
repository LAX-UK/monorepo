"use client";

import { AuditTimeline } from "@/components/admin/audit/audit-timeline";
import { useLotDetailReadiness } from "@/components/admin/lot-detail/lot-detail-readiness-context";
import { lotDetailTabHref } from "@/components/admin/lot-detail/lot-detail-types";
import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { toIssueItems } from "@/lib/admin/detail-board/to-issue-items";
import type { LotDetailContext } from "@/lib/admin/lot-detail-context";
import type { AdminLotAttention } from "@/lib/data/http/admin-lot-attention.server";
import type { AdminLotDetailMetrics } from "@/lib/data/http/admin-lot-detail-metrics.server";
import type { AdminLotOverviewKpiTrends } from "@/lib/data/http/admin-lot-overview-kpi-trends.server";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import { buildLotOverviewViewModel } from "@/lib/data/view-models/lot-overview.vm";
import {
  DetailColumns,
  IssueList,
  KeyValueList,
  RecordImage,
  Section,
  StaffButton,
  type StaffLinkComponent,
  StatGrid,
} from "@auction/staff-ui";
import type { Lot } from "@auction/types";
import Link from "next/link";
import { useMemo } from "react";

const NextLink: StaffLinkComponent = Link;

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

/** Facts the page header already shows (type, sale, artist) or the numbers above repeat. */
const IN_HEADER_OR_NUMBERS = new Set(["reserve", "hammer", "type", "sale", "artist"]);

/**
 * The lot at a glance: its numbers, what needs doing, pricing and timing, and the catalogue
 * entry; photos, recent activity and the record's dates in the rail. What blocks publishing is
 * the page notice, so it is not repeated here; each fact appears once on the page.
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
  const readiness = readinessContext?.publishReadiness ?? null;
  const deleteBlockers = readinessContext?.canManageAuction
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
        deleteBlockers,
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
      deleteBlockers,
      metrics,
      attention,
      kpiTrends,
      kpiPeriodDays,
    ],
  );

  const issues = toIssueItems(vm.attentionRows.filter((row) => !row.id.startsWith("readiness-")));
  const imageAlts = auction.marketingDetails.imageAlts ?? [];
  const keep = (row: { id: string }) => !IN_HEADER_OR_NUMBERS.has(row.id);

  const rail = (
    <>
      <Section
        title="Photos"
        action={
          <StaffButton asChild size="sm" variant="ghost">
            <Link href={lotDetailTabHref(lotId, "images")}>Manage</Link>
          </StaffButton>
        }
      >
        {auction.images.length > 0 ? (
          <RecordImage src={auction.images[0] ?? ""} alt={imageAlts[0] ?? auction.title} />
        ) : (
          <p className="text-staff-sm text-staff-muted">
            No photos yet. Add them before publishing.
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
          empty="No activity recorded yet."
          events={activityEvents}
          limit={5}
        />
      </Section>
      <Section title="Record">
        <KeyValueList
          items={vm.auditRows
            .filter((row) => row.id === "created" || row.id === "updated")
            .map((row) => ({ label: row.label, value: row.value }))}
        />
      </Section>
    </>
  );

  return (
    <DetailColumns rail={rail} railLabel="Lot activity">
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
      <IssueList Link={NextLink} items={issues} allClear={null} />
      <Section title="Pricing and timing">
        <KeyValueList
          items={vm.commercialRows
            .filter(keep)
            .map((row) => ({ label: row.label, value: row.value }))}
        />
      </Section>
      <Section id="catalogue" title="Catalogue entry">
        <KeyValueList
          items={vm.catalogueRows
            .filter(keep)
            .map((row) => ({ label: row.label, value: row.value }))}
        />
      </Section>
    </DetailColumns>
  );
}
