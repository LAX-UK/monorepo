"use server";

import { dashboardProfileIdForStaffRole } from "@/lib/admin/dashboard-profile-registry";
import { recordDashboardTelemetry } from "@/lib/admin/dashboard/dashboard-telemetry";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { ADMIN_HOME_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { UserStaffRole } from "@auction/types";

const ALLOWED_PROFILE_IDS = new Set([
  "oversight",
  "auction_operations",
  "catalogue",
  "finance",
  "compliance",
  "service_fulfilment",
  "read_only",
]);

const ALLOWED_KPI_IDS = new Set([
  "live-lots",
  "new-lots",
  "submissions",
  "payments",
  "stale-payments",
  "revenue-today",
  "bids-per-minute",
]);

const ROW_ID_PATTERN = /^[a-z0-9-]+$/;

function sanitizeProfileId(profileId: string): string | null {
  return ALLOWED_PROFILE_IDS.has(profileId) ? profileId : null;
}

function sanitizeKpiId(kpiId: string): string | null {
  return ALLOWED_KPI_IDS.has(kpiId) ? kpiId : null;
}

function sanitizeRowId(rowId: string): string | null {
  return ROW_ID_PATTERN.test(rowId) && rowId.length <= 64 ? rowId : null;
}

export async function logDashboardQueueOpenAction(profileId: string, rowId: string): Promise<void> {
  return instrumentServerAction("logDashboardQueueOpenAction", async () => {
    const denied = await denyUnlessAdminCapability(ADMIN_HOME_ACCESS);
    if (denied && !denied.ok) return;

    const safeProfile = sanitizeProfileId(profileId);
    const safeRow = sanitizeRowId(rowId);
    if (!safeProfile || !safeRow) return;

    recordDashboardTelemetry({
      kind: "queue_open",
      profileId: safeProfile,
      rowId: safeRow,
    });
  });
}

export async function logDashboardKpiDrilldownAction(
  profileId: string,
  kpiId: string,
): Promise<void> {
  return instrumentServerAction("logDashboardKpiDrilldownAction", async () => {
    const denied = await denyUnlessAdminCapability(ADMIN_HOME_ACCESS);
    if (denied && !denied.ok) return;

    const safeProfile = sanitizeProfileId(profileId);
    const safeKpi = sanitizeKpiId(kpiId);
    if (!safeProfile || !safeKpi) return;

    recordDashboardTelemetry({
      kind: "kpi_drilldown",
      profileId: safeProfile,
      kpiId: safeKpi,
    });
  });
}

export async function logDashboardCustomizeSaveAction(widgetCount: number): Promise<void> {
  return instrumentServerAction("logDashboardCustomizeSaveAction", async () => {
    const denied = await denyUnlessAdminCapability(ADMIN_HOME_ACCESS);
    if (denied && !denied.ok) return;

    const user = await requireAuthenticatedUser({ shell: "staff", loginNext: "/admin" });
    const profileId = dashboardProfileIdForStaffRole(
      (user.staffRole ?? null) as UserStaffRole | null,
    );

    recordDashboardTelemetry({
      kind: "customize_save",
      profileId,
      widgetCount: Math.min(Math.max(0, widgetCount), 20),
    });
  });
}
