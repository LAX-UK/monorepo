import { AdminSaleroomHubBoard } from "@/components/admin/saleroom-hub-board";
import { SaleroomHubLiveGrid } from "@/components/admin/saleroom-hub-board/saleroom-hub-live-grid";
import type { saleroomHubController } from "@/lib/admin/saleroom-hub-controller";
import { getAdminExpectedGuests } from "@/lib/data/http/admin-expected-guests.server";
import { getAdminSaleroomSessions } from "@/lib/data/http/admin.server";
import {
  enrichHubRowWithCurrentLot,
  mapSaleroomHubRowSummary,
} from "@/lib/data/view-models/admin-saleroom-hub.vm";
import type { PublicSaleroomSessionStatus } from "@/lib/saleroom/public-session-status";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Saleroom console",
  "Monitor live rooms and open the clerk console for each sale.",
);

type SaleroomHubViewProps = {
  rows: Awaited<ReturnType<typeof saleroomHubController.fetch>>["rows"];
  summaries: ReturnType<typeof mapSaleroomHubRowSummary>[];
  initialSessions: Record<string, PublicSaleroomSessionStatus>;
  scheduledOnlyRows: Awaited<ReturnType<typeof saleroomHubController.fetch>>["rows"];
};

export async function buildSaleroomHubViewData(
  rows: Awaited<ReturnType<typeof saleroomHubController.fetch>>["rows"],
): Promise<SaleroomHubViewProps> {
  const summaries = rows.map(mapSaleroomHubRowSummary);

  let sessionResults: {
    saleId: string;
    status: PublicSaleroomSessionStatus;
    summary: ReturnType<typeof mapSaleroomHubRowSummary>;
  }[] = [];

  try {
    const batch = await getAdminSaleroomSessions(rows.map((row) => row.sale.id));
    const statusBySaleId = new Map(batch.map((row) => [row.saleId, row]));
    sessionResults = rows.map((row) => {
      const rowStatus = statusBySaleId.get(row.sale.id);
      const status: PublicSaleroomSessionStatus = rowStatus
        ? { status: rowStatus.status, currentLotId: rowStatus.currentLotId }
        : { status: "none", currentLotId: null };
      const summary = enrichHubRowWithCurrentLot(
        mapSaleroomHubRowSummary(row),
        row.lots,
        status.currentLotId,
      );
      return { saleId: row.sale.id, status, summary };
    });
  } catch {
    sessionResults = rows.map((row) => ({
      saleId: row.sale.id,
      status: { status: "none" as const, currentLotId: null },
      summary: mapSaleroomHubRowSummary(row),
    }));
  }

  const initialSessions: Record<string, PublicSaleroomSessionStatus> = {};
  const enrichedSummaries = summaries.map((s) => {
    const match = sessionResults.find((r) => r.saleId === s.saleId);
    if (match) {
      initialSessions[s.saleId] = match.status;
      return match.summary;
    }
    return s;
  });

  const liveGridRows = enrichedSummaries.filter((s) => s.saleStatus === "active");
  const scheduledOnlyRows = rows.filter((r) => r.sale.status === "scheduled");

  const venueCountsBySaleId = new Map<
    string,
    NonNullable<(typeof liveGridRows)[number]["venueDayCounts"]>
  >();
  await Promise.all(
    liveGridRows.map(async (row) => {
      try {
        const summary = await getAdminExpectedGuests(row.saleId);
        if (!summary.eventSlug) return;
        venueCountsBySaleId.set(row.saleId, {
          eventSlug: summary.eventSlug,
          eventTitle: summary.eventTitle ?? summary.eventSlug,
          rsvped: summary.counts.rsvped,
          galaCheckedIn: summary.counts.galaCheckedIn,
          paddled: summary.counts.paddled,
        });
      } catch {
        // Non-fatal — hub cards still render without venue-day counts.
      }
    }),
  );

  const summariesWithVenueCounts = liveGridRows.map((row) => ({
    ...row,
    venueDayCounts: venueCountsBySaleId.get(row.saleId) ?? null,
  }));

  return {
    rows,
    summaries: summariesWithVenueCounts,
    initialSessions,
    scheduledOnlyRows,
  };
}

export { AdminSaleroomHubBoard, SaleroomHubLiveGrid };
