import type { AdminActivityRow } from "@/lib/admin/admin-home-types";
import type { DashboardSlice } from "@/lib/admin/dashboard/slice-state";

export type RecentActivityData = {
  rows: AdminActivityRow[];
};

export type RecentActivitySlice = DashboardSlice<RecentActivityData>;

export function buildRecentActivitySlice(rows: readonly AdminActivityRow[]): RecentActivitySlice {
  const data = { rows: [...rows] };
  if (rows.length === 0) {
    return {
      status: "empty",
      data,
      message: "No recent catalogue activity to show yet.",
    };
  }
  return { status: "ready", data };
}
