import type { DashboardLoadContext } from "@/lib/admin/dashboard/dashboard-load-context";
import { recordDashboardSliceFailure } from "@/lib/admin/dashboard/dashboard-telemetry";
import { type DashboardSlice, unavailableSlice } from "@/lib/admin/dashboard/slice-state";
import type { AdminSaleReadinessRow } from "@/lib/data/http/admin-sale-readiness.schema";

export type SaleReadinessData = {
  rows: readonly AdminSaleReadinessRow[];
  bidsPerMinute: number;
  activeSaleroomSessions: number;
};

export type SaleReadinessSlice = DashboardSlice<SaleReadinessData>;

export type SaleReadinessLoadResult = {
  slice: SaleReadinessSlice;
  loadWarning: string | null;
};

export async function loadSaleReadinessSlice(
  ctx: DashboardLoadContext,
  live: { bidsPerMinute: number; activeSaleroomSessions: number },
): Promise<SaleReadinessLoadResult> {
  if (!ctx.profile.showLiveOperations) {
    return {
      slice: {
        status: "empty",
        data: { rows: [], bidsPerMinute: 0, activeSaleroomSessions: 0 },
        message: "Sale readiness is not shown for this profile.",
      },
      loadWarning: null,
    };
  }

  try {
    const rows = await ctx.sources.getSaleReadiness(6);
    if (rows.length === 0) {
      return {
        slice: {
          status: "empty",
          data: {
            rows: [],
            bidsPerMinute: live.bidsPerMinute,
            activeSaleroomSessions: live.activeSaleroomSessions,
          },
          message: "No upcoming or live sales in the next week.",
        },
        loadWarning: null,
      };
    }
    return {
      slice: {
        status: "ready",
        data: {
          rows,
          bidsPerMinute: live.bidsPerMinute,
          activeSaleroomSessions: live.activeSaleroomSessions,
        },
      },
      loadWarning: null,
    };
  } catch {
    recordDashboardSliceFailure({
      slice: "sale-readiness",
      profileId: ctx.profileId,
      retryable: true,
    });
    return {
      slice: unavailableSlice<SaleReadinessData>("Could not load sale readiness."),
      loadWarning: "Could not load sale readiness rail.",
    };
  }
}
