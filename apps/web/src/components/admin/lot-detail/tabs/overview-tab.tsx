"use client";

import { AuditTimeline } from "@/components/admin/audit/audit-timeline";
import { useLotDetailReadiness } from "@/components/admin/lot-detail/lot-detail-readiness-context";
import { lotDetailTabHref } from "@/components/admin/lot-detail/lot-detail-types";
import { BuyerDefaultCard } from "@/components/admin/reoffer/buyer-default-card";
import { ReofferCardSection } from "@/components/admin/reoffer/reoffer-card-section";
import { LotSellerProceedsSection } from "@/components/admin/seller-proceeds/lot-seller-proceeds-section";
import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { toIssueItems } from "@/lib/admin/detail-board/to-issue-items";
import type { DetailStatRow } from "@/lib/admin/detail-board/types";
import type { LotDetailContext } from "@/lib/admin/lot-detail-context";
import type { LotReofferBundle } from "@/lib/admin/reoffer/reoffer-bundle";
import { offerPriceTile, openOffer, showsReofferCard } from "@/lib/admin/reoffer/reoffer-lot-state";
import type { LotSellerProceedsPage } from "@/lib/admin/seller-proceeds/load-lot-seller-proceeds";
import type { AdminLotAttention } from "@/lib/data/http/admin-lot-attention.server";
import type { AdminLotDetailMetrics } from "@/lib/data/http/admin-lot-detail-metrics.server";
import type { AdminLotOverviewKpiTrends } from "@/lib/data/http/admin-lot-overview-kpi-trends.server";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import { buildLotOverviewViewModel } from "@/lib/data/view-models/lot-overview.vm";
import {
  DetailColumns,
  EmptyState,
  IssueList,
  KeyValueList,
  RecordImage,
  Section,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  StatGrid,
} from "@auction/staff-ui";
import type { Lot } from "@auction/types";
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
  /** The lot's re-offer story; left out for a lot that cannot have one. */
  reoffers?: LotReofferBundle | null;
  reofferAccess?: { canAct: boolean; canRecordAnswer: boolean };
  /** The seller's side of a sold lot; left out before it sells. */
  sellerProceeds?: LotSellerProceedsPage | null;
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
  reoffers = null,
  reofferAccess = { canAct: false, canRecordAnswer: false },
  sellerProceeds = null,
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

  const lotFacts = { status: auction.status, hasWinner: auction.winnerId != null };
  const readyReoffers =
    reoffers?.status === "ready" && showsReofferCard(reoffers, lotFacts) ? reoffers : null;
  const tiles = offerPriceTile(
    vm.kpiTiles.slice(0, 4),
    readyReoffers ? openOffer(readyReoffers.offers) : null,
  );

  const rail = (
    <>
      {readyReoffers ? (
        <BuyerDefaultCard
          buyerDefault={readyReoffers.buyerDefault}
          latestOffer={readyReoffers.offers.at(-1) ?? null}
        />
      ) : null}
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
          <EmptyState
            size="compact"
            headingLevel="h3"
            illustration="frame"
            title="No photos yet"
            description="Add them before publishing."
          />
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
            .map(statItem)}
        />
      </Section>
    </>
  );

  return (
    <DetailColumns rail={rail} railLabel="Lot activity">
      <StatGrid
        label="Lot numbers"
        items={tiles.map((tile) => ({
          id: tile.id,
          label: tile.label,
          // Whole pounds for a range, as the lists show it: "£2,000–£3,000".
          value:
            tile.id === "estimate"
              ? tile.value.replace(/\.00/g, "").replace(" – ", "–")
              : tile.value,
        }))}
      />
      <IssueList Link={NextLink} items={issues} allClear={null} />
      {reoffers ? (
        <ReofferCardSection
          bundle={reoffers}
          lot={{
            id: lotId,
            title: auction.title,
            status: auction.status,
            hasWinner: lotFacts.hasWinner,
          }}
          canAct={reofferAccess.canAct}
          canRecordAnswer={reofferAccess.canRecordAnswer}
        />
      ) : null}
      {sellerProceeds ? (
        <LotSellerProceedsSection
          lotId={lotId}
          state={sellerProceeds.state}
          record={sellerProceeds.record}
          canSettleOutside={sellerProceeds.canSettleOutside}
          replace={sellerProceeds.replace}
        />
      ) : null}
      <Section title="Pricing and timing">
        <KeyValueList items={vm.commercialRows.filter(keep).map(statItem)} />
      </Section>
      <Section id="catalogue" title="Catalogue entry">
        <KeyValueList items={vm.catalogueRows.filter(keep).map(statItem)} />
      </Section>
    </DetailColumns>
  );
}
