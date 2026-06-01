"use server";

import { instrumentServerAction } from "@/lib/observability/instrument-server-action";

import {
  ADMIN_DASHBOARD_WIDGETS_COOKIE,
  type DashboardWidgetState,
  serializeDashboardWidgetsCookie,
} from "@/lib/admin/dashboard-widgets.vm";
import { denyUnlessAdminCapability } from "@/lib/auth/assert-admin-action-capability";
import { ADMIN_HOME_ACCESS } from "@/lib/navigation/staff-nav-access";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

export async function persistAdminDashboardWidgetsAction(
  widgets: readonly DashboardWidgetState[],
): Promise<void> {
  return instrumentServerAction("persistAdminDashboardWidgetsAction", async () => {
    const denied = await denyUnlessAdminCapability(ADMIN_HOME_ACCESS);
    if (denied && !denied.ok) {
      throw new Error(denied.error);
    }
    const jar = await cookies();
    jar.set(ADMIN_DASHBOARD_WIDGETS_COOKIE, serializeDashboardWidgetsCookie(widgets), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: false,
    });
    revalidatePath("/admin");
  });
}
