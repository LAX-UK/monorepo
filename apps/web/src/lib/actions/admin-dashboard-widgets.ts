"use server";

import { allowedDashboardWidgets } from "@/lib/admin/dashboard-access";
import { dashboardProfileIdForStaffRole } from "@/lib/admin/dashboard-profile-registry";
import {
  ADMIN_DASHBOARD_WIDGETS_COOKIE,
  type DashboardWidgetState,
  serializeDashboardWidgetsCookie,
} from "@/lib/admin/dashboard-widgets.vm";
import { recordDashboardTelemetry } from "@/lib/admin/dashboard/dashboard-telemetry";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { requireAuthenticatedUser } from "@/lib/auth/guards.server";
import { ADMIN_HOME_ACCESS } from "@/lib/navigation/staff-nav-access";
import { instrumentServerAction } from "@/lib/observability/instrument-server-action";
import type { UserRole, UserStaffRole } from "@auction/types";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

const MAX_WIDGETS = 20;

function sanitizeWidgets(
  widgets: readonly DashboardWidgetState[],
  role: UserRole,
  staffRole: UserStaffRole | null,
): DashboardWidgetState[] {
  const allowed = allowedDashboardWidgets(role, staffRole, widgets.slice(0, MAX_WIDGETS));
  const seen = new Set<string>();
  return allowed.filter((widget) => {
    if (seen.has(widget.id)) return false;
    seen.add(widget.id);
    return true;
  });
}

export async function persistAdminDashboardWidgetsAction(
  widgets: readonly DashboardWidgetState[],
): Promise<void> {
  return instrumentServerAction("persistAdminDashboardWidgetsAction", async () => {
    const denied = await denyUnlessAdminCapability(ADMIN_HOME_ACCESS);
    if (denied && !denied.ok) {
      throw new Error(denied.error);
    }

    const user = await requireAuthenticatedUser({ shell: "staff", loginNext: "/admin" });
    const role = (user.role ?? "staff") as UserRole;
    const staffRole = (user.staffRole ?? null) as UserStaffRole | null;
    const profileId = dashboardProfileIdForStaffRole(staffRole);
    const sanitized = sanitizeWidgets(widgets, role, staffRole);

    if (sanitized.length === 0) {
      throw new Error("At least one dashboard module must remain visible.");
    }

    const jar = await cookies();
    jar.set(ADMIN_DASHBOARD_WIDGETS_COOKIE, serializeDashboardWidgetsCookie(sanitized), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: false,
    });

    recordDashboardTelemetry({
      kind: "customize_save",
      profileId,
      widgetCount: sanitized.filter((widget) => !widget.hidden).length,
    });

    revalidatePath("/admin");
  });
}
