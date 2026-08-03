import type { DashboardSlice } from "@/lib/admin/dashboard/slice-state";
import type { OnsiteSalesRadarRow } from "@/lib/admin/saleroom/map-operations-snapshot-to-radar-row";

export type LiveOperationsData = {
  radarRows: OnsiteSalesRadarRow[];
  activeSaleroomSessions: number;
  bidsPerMinute: number;
  activeLotIds: string[];
};

export type LiveOperationsSlice = DashboardSlice<LiveOperationsData>;

export function buildLiveOperationsSlice(input: {
  radarRows: readonly OnsiteSalesRadarRow[];
  bidsPerMinute: number;
  activeLotIds: readonly string[];
  enabled: boolean;
}): LiveOperationsSlice {
  if (!input.enabled) {
    return {
      status: "unavailable",
      message: "Live operations are not available for your role.",
      retryable: false,
    };
  }

  const radarRows = [...input.radarRows];
  const activeSaleroomSessions = radarRows.filter((row) => row.isLiveSession).length;
  const data: LiveOperationsData = {
    radarRows,
    activeSaleroomSessions,
    bidsPerMinute: input.bidsPerMinute,
    activeLotIds: [...input.activeLotIds],
  };

  if (radarRows.length === 0 && activeSaleroomSessions === 0 && input.bidsPerMinute === 0) {
    return {
      status: "empty",
      data,
      message: "No live saleroom sessions need monitoring right now.",
    };
  }

  return { status: "ready", data };
}
