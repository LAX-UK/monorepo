import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { canAccess } from "@/lib/admin/dashboard-access";
import {
  type DashboardProfile,
  type DashboardProfileId,
  getDashboardProfile,
} from "@/lib/admin/dashboard-profile-registry";
import type { DashboardWidgetState } from "@/lib/admin/dashboard-widgets.vm";
import type { DashboardDataSources } from "@/lib/admin/dashboard/dashboard-data-sources";
import type { CapabilityRequirement, UserRole, UserStaffRole } from "@auction/types";

/** Resolved access + profile context shared by dashboard slice loaders. */
export type DashboardLoadContext = {
  periodDays: AdminKpiPeriodDays;
  role: UserRole;
  staffRole: UserStaffRole | null;
  widgets: readonly DashboardWidgetState[];
  profile: DashboardProfile;
  profileId: DashboardProfileId;
  sources: DashboardDataSources;
  can: (requirement: CapabilityRequirement) => boolean;
};

export function createDashboardLoadContext(input: {
  periodDays: AdminKpiPeriodDays;
  role: UserRole;
  staffRole: UserStaffRole | null;
  widgets: readonly DashboardWidgetState[];
  sources: DashboardDataSources;
}): DashboardLoadContext {
  const profile = getDashboardProfile(input.staffRole);
  const can = (requirement: CapabilityRequirement) =>
    canAccess(input.role, input.staffRole, requirement);

  return {
    periodDays: input.periodDays,
    role: input.role,
    staffRole: input.staffRole,
    widgets: input.widgets,
    profile,
    profileId: profile.id,
    sources: input.sources,
    can,
  };
}
