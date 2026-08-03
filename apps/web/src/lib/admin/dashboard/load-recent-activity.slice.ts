import type { AdminActivityRow } from "@/lib/admin/admin-home-types";
import { isWidgetAllowed } from "@/lib/admin/dashboard-access";
import { isDashboardWidgetVisible } from "@/lib/admin/dashboard-widgets.vm";
import type { DashboardLoadContext } from "@/lib/admin/dashboard/dashboard-load-context";
import { recordDashboardSliceFailure } from "@/lib/admin/dashboard/dashboard-telemetry";
import {
  type RecentActivitySlice,
  buildRecentActivitySlice,
} from "@/lib/admin/dashboard/recent-activity.slice";
import { formatDateTime, formatMoney } from "@/lib/ui/format";
import { LOTS_ACCESS } from "@auction/types";

function mapRecentActivity(
  lots: Awaited<ReturnType<DashboardLoadContext["sources"]["getRecentLots"]>>,
): AdminActivityRow[] {
  return lots.slice(0, 10).map((lot) => ({
    id: lot.id,
    title: lot.title,
    meta: `${lot.status} · ends ${formatDateTime(lot.endTime)}`,
    href: `/admin/lots/${lot.id}`,
    statusLabel: lot.status,
    winnerId: lot.winnerId ?? null,
    priceLabel: formatMoney(lot.currentPrice),
    endsLabel: formatDateTime(lot.endTime),
  }));
}

export type RecentActivityLoadResult = {
  slice: RecentActivitySlice;
  activity: AdminActivityRow[];
};

/** Loads recent catalog activity when the widget is visible and lots are accessible. */
export async function loadRecentActivitySlice(
  ctx: DashboardLoadContext,
): Promise<RecentActivityLoadResult> {
  const canAccessLots = ctx.can(LOTS_ACCESS);
  const showActivity =
    canAccessLots &&
    isWidgetAllowed(ctx.role, ctx.staffRole, "activity") &&
    isDashboardWidgetVisible(ctx.widgets, "activity");

  if (!showActivity) {
    return {
      slice: buildRecentActivitySlice([]),
      activity: [],
    };
  }

  try {
    const lots = await ctx.sources.getRecentLots(12);
    const activity = mapRecentActivity(lots);
    return {
      slice: buildRecentActivitySlice(activity),
      activity,
    };
  } catch {
    recordDashboardSliceFailure({
      slice: "recent-activity",
      profileId: ctx.profileId,
      retryable: true,
    });
    return {
      slice: {
        status: "unavailable",
        message: "Recent activity could not load.",
        retryable: true,
      },
      activity: [],
    };
  }
}
