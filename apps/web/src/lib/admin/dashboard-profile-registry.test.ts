import type { UserStaffRole } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  dashboardProfileIdForStaffRole,
  getDashboardProfile,
  listDashboardProfiles,
  resolvePrimaryActionForProfile,
} from "./dashboard-profile-registry";

const STAFF_ROLES: UserStaffRole[] = [
  "super_admin",
  "auction_manager",
  "operations",
  "catalogue_manager",
  "specialist",
  "content_marketing",
  "finance_ops",
  "compliance_officer",
  "operations_fulfilment",
  "support_concierge",
  "client_advisor",
  "staff_viewer",
];

describe("dashboard-profile-registry", () => {
  it.each(STAFF_ROLES)("maps %s to a documented profile", (staffRole) => {
    const profileId = dashboardProfileIdForStaffRole(staffRole);
    const profile = getDashboardProfile(staffRole);
    expect(profile.id).toBe(profileId);
    expect(profile.decisions.length).toBeGreaterThan(0);
    expect(profile.kpiIds.length).toBeGreaterThanOrEqual(2);
    expect(profile.kpiIds.length).toBeLessThanOrEqual(5);
    expect(profile.primaryAction.href).toBeTruthy();
    expect(profile.primaryAction.fallbackHref).toBeTruthy();
  });

  it("lists every profile exactly once", () => {
    expect(listDashboardProfiles()).toHaveLength(7);
  });

  it("falls back primary action when capability is missing", () => {
    const profile = getDashboardProfile("finance_ops");
    const action = resolvePrimaryActionForProfile(profile, () => false);
    expect(action.href).toBe(profile.primaryAction.fallbackHref);
    expect(action.label).toBe(profile.primaryAction.fallbackLabel);
  });

  it("keeps read-only browse action without requirements", () => {
    const profile = getDashboardProfile("staff_viewer");
    const action = resolvePrimaryActionForProfile(profile, () => false);
    expect(action.href).toBe(profile.primaryAction.href);
  });

  it("exposes role-relevant KPI ids per profile", () => {
    const finance = getDashboardProfile("finance_ops");
    expect(finance.kpiIds).toContain("stale-payments");
    expect(finance.kpiIds).not.toContain("bids-per-minute");

    const catalogue = getDashboardProfile("catalogue_manager");
    expect(catalogue.kpiIds).toContain("submissions");
    expect(catalogue.showLiveOperations).toBe(false);
  });
});
