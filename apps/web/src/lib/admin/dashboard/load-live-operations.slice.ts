import { isWidgetAllowed } from "@/lib/admin/dashboard-access";
import { isDashboardWidgetVisible } from "@/lib/admin/dashboard-widgets.vm";
import type { DashboardLoadContext } from "@/lib/admin/dashboard/dashboard-load-context";
import { recordDashboardSliceFailure } from "@/lib/admin/dashboard/dashboard-telemetry";
import {
  type LiveOperationsSlice,
  buildLiveOperationsSlice,
} from "@/lib/admin/dashboard/live-operations.slice";
import {
  type OnsiteSalesRadarRow,
  mapOperationsSnapshotToRadarRow,
} from "@/lib/admin/saleroom/map-operations-snapshot-to-radar-row";
import { LOTS_ACCESS, SALEROOM_ACCESS } from "@auction/types";

export type LiveOperationsLoadResult = {
  slice: LiveOperationsSlice;
  onsiteRadarRows: OnsiteSalesRadarRow[];
  bidsPerMinute: number;
  activeLotIds: string[];
  loadWarning: string | null;
};

/** Loads saleroom radar and live metrics when the viewer's widgets and capabilities allow. */
export async function loadLiveOperationsSlice(
  ctx: DashboardLoadContext,
): Promise<LiveOperationsLoadResult> {
  const canAccessSaleroom = ctx.can(SALEROOM_ACCESS);
  const canAccessLots = ctx.can(LOTS_ACCESS);
  const showLiveOps =
    ctx.profile.showLiveOperations &&
    canAccessSaleroom &&
    isWidgetAllowed(ctx.role, ctx.staffRole, "onsite-radar") &&
    isDashboardWidgetVisible(ctx.widgets, "onsite-radar");

  const showSaleroomLive =
    isWidgetAllowed(ctx.role, ctx.staffRole, "saleroom-live") &&
    isDashboardWidgetVisible(ctx.widgets, "saleroom-live");

  let bidsPerMinute = 0;
  let activeLotIds: string[] = [];
  let onsiteRadarRows: OnsiteSalesRadarRow[] = [];
  const loadWarning: string | null = null;

  const needsLiveMetrics = showSaleroomLive || showLiveOps;
  const needsActiveLots = showSaleroomLive && canAccessLots;

  if (!needsLiveMetrics && !showLiveOps) {
    return {
      slice: buildLiveOperationsSlice({
        radarRows: [],
        bidsPerMinute: 0,
        activeLotIds: [],
        enabled: false,
      }),
      onsiteRadarRows: [],
      bidsPerMinute: 0,
      activeLotIds: [],
      loadWarning: null,
    };
  }

  const [liveR, activeR] = await Promise.allSettled([
    needsLiveMetrics ? ctx.sources.getMetricsLive() : Promise.resolve({ bidsPerMinute: 0 }),
    needsActiveLots ? ctx.sources.getActiveLots(20) : Promise.resolve([]),
  ]);

  if (liveR.status === "fulfilled") {
    bidsPerMinute = liveR.value.bidsPerMinute;
  } else if (needsLiveMetrics) {
    recordDashboardSliceFailure({
      slice: "live-metrics",
      profileId: ctx.profileId,
      retryable: true,
    });
  }

  if (activeR.status === "fulfilled") {
    activeLotIds = activeR.value.map((lot) => lot.id);
  } else if (needsActiveLots) {
    recordDashboardSliceFailure({
      slice: "active-lots",
      profileId: ctx.profileId,
      retryable: true,
    });
  }

  if (showLiveOps) {
    try {
      const snapshots = await ctx.sources.getOperationsRadar(6);
      onsiteRadarRows = snapshots
        .map((snapshot) => mapOperationsSnapshotToRadarRow(snapshot))
        .filter((row): row is OnsiteSalesRadarRow => row != null);
    } catch {
      recordDashboardSliceFailure({
        slice: "live-operations",
        profileId: ctx.profileId,
        retryable: true,
      });
      return {
        slice: {
          status: "unavailable",
          message: "Live operations could not load. Saleroom links remain available.",
          retryable: true,
        },
        onsiteRadarRows: [],
        bidsPerMinute,
        activeLotIds,
        loadWarning,
      };
    }
  }
  const slice = buildLiveOperationsSlice({
    radarRows: onsiteRadarRows,
    bidsPerMinute,
    activeLotIds,
    enabled: showLiveOps || (canAccessSaleroom && showSaleroomLive),
  });

  return {
    slice,
    onsiteRadarRows,
    bidsPerMinute,
    activeLotIds,
    loadWarning,
  };
}
