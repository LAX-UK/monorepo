import { AdminSaleroomHubBoard } from "@/components/admin/saleroom-hub-board";
import { SaleroomHubLiveGrid } from "@/components/admin/saleroom-hub-board/saleroom-hub-live-grid";
import type { saleroomHubController } from "@/lib/admin/saleroom-hub-controller";
import { getAdminSaleroomSession } from "@/lib/data/http/admin.server";
import {
  enrichHubRowWithCurrentLot,
  mapSaleroomHubRowSummary,
} from "@/lib/data/view-models/admin-saleroom-hub.vm";
import { mapAdminSaleroomSnapshotToSessionStatus } from "@/lib/saleroom/map-admin-saleroom-snapshot";
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

  const sessionResults = await Promise.all(
    rows.map(async (row) => {
      try {
        const snap = await getAdminSaleroomSession(row.sale.id);
        const status = mapAdminSaleroomSnapshotToSessionStatus(snap);
        const summary = enrichHubRowWithCurrentLot(
          mapSaleroomHubRowSummary(row),
          row.lots,
          status.currentLotId,
        );
        return { saleId: row.sale.id, status, summary };
      } catch {
        return {
          saleId: row.sale.id,
          status: { status: "none" as const, currentLotId: null },
          summary: mapSaleroomHubRowSummary(row),
        };
      }
    }),
  );

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

  return {
    rows,
    summaries: liveGridRows,
    initialSessions,
    scheduledOnlyRows,
  };
}

export { AdminSaleroomHubBoard, SaleroomHubLiveGrid };
