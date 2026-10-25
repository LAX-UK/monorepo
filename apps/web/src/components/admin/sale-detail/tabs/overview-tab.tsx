"use client";

import { AuditTimeline } from "@/components/admin/audit/audit-timeline";
import { useSaleDetailReadiness } from "@/components/admin/sale-detail/sale-detail-readiness-context";
import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import type { ConnectRequiredByLotId } from "@/lib/admin/connect-readiness";
import { toIssueItems } from "@/lib/admin/detail-board/to-issue-items";
import type { DetailStatRow } from "@/lib/admin/detail-board/types";
import { useSaleAttentionDismiss } from "@/lib/admin/detail-board/use-sale-attention-dismiss";
import type { AdminSaleAttention } from "@/lib/data/http/admin-sale-attention.server";
import type { AdminSaleDetailMetrics } from "@/lib/data/http/admin-sale-detail-metrics.server";
import type { AdminSaleOverviewKpiTrends } from "@/lib/data/http/admin-sale-overview-kpi-trends.server";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import { buildSaleOverviewViewModel } from "@/lib/data/view-models/sale-overview.vm";
import {
  DetailColumns,
  IssueList,
  KeyValueList,
  Section,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  StatGrid,
} from "@auction/staff-ui";
import type { Lot, Sale } from "@auction/types";
import Link from "next/link";
import { useMemo } from "react";

const NextLink: StaffLinkComponent = Link;

/** A fact for a key-value list; a date reads in London time with its zone. */
function statItem(row: DetailStatRow) {
  return {
    label: row.label,
    value: row.dateIso ? <StaffDate value={row.dateIso} withTime /> : row.value,
  };
}

/** Four numbers per stage: before the sale, what is lined up; once it runs, what it makes. */
function tilesFor(status: Sale["status"]): readonly string[] {
  return status === "draft" || status === "scheduled"
    ? ["lots", "estimate", "registrations", "revenue"]
    : ["lots", "hammer", "revenue", "bidders"];
}

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

/**
 * The sale at a glance: its numbers, what needs doing (open setup checks, bidders waiting,
 * what stops a delete), and bids by channel; recent activity and the record's dates in the rail.
 */
export function SaleOverviewTab({
  saleId,
  sale,
  lots,
  registrationCount,
  pendingRegistrationCount = null,
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
  const deleteBlockers = readinessContext?.canManageSales
    ? (readinessContext.deleteBlockers ?? [])
    : [];

  const vm = buildSaleOverviewViewModel({
    saleId,
    sale,
    lots,
    registrationCount,
    pendingRegistrationCount,
    readiness,
    deleteBlockers,
    metrics,
    attention,
    trends: kpiTrends,
    periodDays: kpiPeriodDays,
  });
  const rows = useMemo(() => filterRows(vm.attentionRows), [filterRows, vm.attentionRows]);
  const issues = toIssueItems(rows);

  const rail = (
    <>
      <Section
        title="Activity"
        action={
          <StaffButton asChild size="sm" variant="ghost">
            <Link href={`/admin/audit?entity=sale&q=${encodeURIComponent(saleId)}`}>
              Open audit log
            </Link>
          </StaffButton>
        }
      >
        <AuditTimeline
          label="Sale activity"
          events={activityEvents}
          limit={5}
          empty="No activity yet. Publishing, cancelling and ending the sale appear here."
        />
      </Section>
      <Section title="Record">
        <KeyValueList items={vm.auditRows.map(statItem)} />
      </Section>
    </>
  );

  return (
    <DetailColumns rail={rail} railLabel="Sale activity">
      <StatGrid
        label="Sale numbers"
        items={vm.kpiTiles
          .filter((tile) => tilesFor(sale.status).includes(tile.id))
          .map((tile) => ({
            id: tile.id,
            label: tile.label,
            value: tile.value,
          }))}
      />
      <IssueList
        Link={NextLink}
        items={issues}
        onDismissAll={() => dismissAll(rows.map((row) => row.id))}
      />
      <Section title="Bids by channel">
        {vm.bidActivityRows.length > 0 ? (
          <KeyValueList
            items={vm.bidActivityRows.map((row) => ({
              label: row.label,
              value: row.value,
              numeric: true,
            }))}
          />
        ) : (
          <KeyValueList items={[{ label: "Bids", value: "None yet" }]} />
        )}
      </Section>
    </DetailColumns>
  );
}
