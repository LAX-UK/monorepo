import { describe, expect, it } from "vitest";
import * as adminAccess from "./admin-access.js";
import {
  ADMIN_HOME_ACCESS,
  ANALYTICS_ACCESS,
  ARTIST_MERGE_ACCESS,
  ARTIST_REVIEW_ACCESS,
  ARTIST_WRITE_ACCESS,
  AUDIT_DOMAIN_EVENTS_ACCESS,
  EMAIL_ADMIN_ACCESS,
  FINANCE_ACCESS,
  INVITATIONS_ACCESS,
  LEGAL_ENTITY_BROWSE_ACCESS,
  LOTS_ACCESS,
  ONBOARDING_QUEUES_ACCESS,
  PAYOUT_REVERSE_ACCESS,
  QR_CODES_ACCESS,
  USERS_DIRECTORY_ACCESS,
  USER_MODERATION_ACCESS,
  USER_PICKER_ACCESS,
  USER_ROLE_MANAGEMENT_ACCESS,
} from "./admin-access.js";
import { userHasAccessTo } from "./role-policy.js";
import type { UserStaffRole } from "./user.js";

function has(
  staffRole: UserStaffRole,
  requirement: Parameters<typeof userHasAccessTo>[2],
): boolean {
  return userHasAccessTo("staff", staffRole, requirement);
}

describe("admin-access requirements", () => {
  it("USERS_DIRECTORY_ACCESS allows super_admin only among sample roles", () => {
    expect(has("super_admin", USERS_DIRECTORY_ACCESS)).toBe(true);
    expect(has("specialist", USERS_DIRECTORY_ACCESS)).toBe(false);
    expect(has("staff_viewer", USERS_DIRECTORY_ACCESS)).toBe(false);
    expect(has("finance_ops", USERS_DIRECTORY_ACCESS)).toBe(false);
  });

  it("LEGAL_ENTITY_BROWSE_ACCESS allows staff_viewer and specialist", () => {
    expect(has("staff_viewer", LEGAL_ENTITY_BROWSE_ACCESS)).toBe(true);
    expect(has("specialist", LEGAL_ENTITY_BROWSE_ACCESS)).toBe(true);
    expect(has("finance_ops", LEGAL_ENTITY_BROWSE_ACCESS)).toBe(true);
  });

  it("LOTS_ACCESS denies staff_viewer", () => {
    expect(has("catalogue_manager", LOTS_ACCESS)).toBe(true);
    expect(has("staff_viewer", LOTS_ACCESS)).toBe(false);
  });

  it("ONBOARDING_QUEUES_ACCESS allows specialist", () => {
    expect(has("specialist", ONBOARDING_QUEUES_ACCESS)).toBe(true);
    expect(has("staff_viewer", ONBOARDING_QUEUES_ACCESS)).toBe(true);
  });

  it("ANALYTICS_ACCESS is super_admin only among sample roles", () => {
    expect(has("super_admin", ANALYTICS_ACCESS)).toBe(true);
    expect(has("auction_manager", ANALYTICS_ACCESS)).toBe(false);
  });

  it("USER_PICKER_ACCESS is narrower than USERS_DIRECTORY_ACCESS", () => {
    expect(has("catalogue_manager", USER_PICKER_ACCESS)).toBe(true);
    expect(has("catalogue_manager", USERS_DIRECTORY_ACCESS)).toBe(false);
  });

  it("USER_MODERATION_ACCESS allows support_concierge", () => {
    expect(has("support_concierge", USER_MODERATION_ACCESS)).toBe(true);
    expect(has("staff_viewer", USER_MODERATION_ACCESS)).toBe(false);
  });

  it("INVITATIONS_ACCESS allows super_admin", () => {
    expect(has("super_admin", INVITATIONS_ACCESS)).toBe(true);
    expect(has("specialist", INVITATIONS_ACCESS)).toBe(false);
  });

  it("USER_ROLE_MANAGEMENT_ACCESS matches INVITATIONS_ACCESS", () => {
    expect(has("super_admin", USER_ROLE_MANAGEMENT_ACCESS)).toBe(true);
    expect(has("support_concierge", USER_ROLE_MANAGEMENT_ACCESS)).toBe(false);
  });

  it("FINANCE_ACCESS allows finance_ops only among sample roles", () => {
    expect(has("finance_ops", FINANCE_ACCESS)).toBe(true);
    expect(has("specialist", FINANCE_ACCESS)).toBe(false);
    expect(has("super_admin", FINANCE_ACCESS)).toBe(true);
  });

  it("PAYOUT_REVERSE_ACCESS allows super_admin", () => {
    expect(has("super_admin", PAYOUT_REVERSE_ACCESS)).toBe(true);
    expect(has("finance_ops", PAYOUT_REVERSE_ACCESS)).toBe(false);
  });

  it("ARTIST_WRITE_ACCESS allows catalogue_manager", () => {
    expect(has("catalogue_manager", ARTIST_WRITE_ACCESS)).toBe(true);
    expect(has("staff_viewer", ARTIST_WRITE_ACCESS)).toBe(false);
  });

  it("ARTIST_REVIEW_ACCESS allows artist reviewer roles", () => {
    expect(has("catalogue_manager", ARTIST_REVIEW_ACCESS)).toBe(true);
    expect(has("staff_viewer", ARTIST_REVIEW_ACCESS)).toBe(false);
  });

  it("ARTIST_MERGE_ACCESS denies staff_viewer", () => {
    expect(has("super_admin", ARTIST_MERGE_ACCESS)).toBe(true);
    expect(has("staff_viewer", ARTIST_MERGE_ACCESS)).toBe(false);
  });

  it("QR_CODES_ACCESS matches LOTS_ACCESS", () => {
    expect(has("catalogue_manager", QR_CODES_ACCESS)).toBe(true);
    expect(has("staff_viewer", QR_CODES_ACCESS)).toBe(false);
  });

  it("ADMIN_HOME_ACCESS allows specialist and staff_viewer", () => {
    expect(has("specialist", ADMIN_HOME_ACCESS)).toBe(true);
    expect(has("staff_viewer", ADMIN_HOME_ACCESS)).toBe(true);
  });

  it("EMAIL_ADMIN_ACCESS matches PLATFORM_ADMIN_ACCESS", () => {
    expect(has("super_admin", EMAIL_ADMIN_ACCESS)).toBe(true);
    expect(has("specialist", EMAIL_ADMIN_ACCESS)).toBe(false);
  });

  it("AUDIT_DOMAIN_EVENTS_ACCESS allows staff_viewer", () => {
    expect(has("staff_viewer", AUDIT_DOMAIN_EVENTS_ACCESS)).toBe(true);
    expect(has("finance_ops", AUDIT_DOMAIN_EVENTS_ACCESS)).toBe(true);
  });

  const ACCESS_MATRIX: {
    name: keyof typeof adminAccess;
    allowed: UserStaffRole;
    denied: UserStaffRole;
  }[] = [
    { name: "SUBMISSIONS_ACCESS", allowed: "specialist", denied: "staff_viewer" },
    { name: "CONDITION_REPORTS_ACCESS", allowed: "catalogue_manager", denied: "staff_viewer" },
    { name: "SALES_ACCESS", allowed: "auction_manager", denied: "staff_viewer" },
    { name: "SALE_CATALOG_ACCESS", allowed: "catalogue_manager", denied: "finance_ops" },
    { name: "ARTISTS_ACCESS", allowed: "specialist", denied: "finance_ops" },
    { name: "ARTIST_DELETE_ACCESS", allowed: "super_admin", denied: "staff_viewer" },
    { name: "CATEGORIES_ACCESS", allowed: "catalogue_manager", denied: "staff_viewer" },
    { name: "SALEROOM_ACCESS", allowed: "auction_manager", denied: "staff_viewer" },
    { name: "CONVEYOR_ACCESS", allowed: "operations_fulfilment", denied: "staff_viewer" },
    { name: "LOT_FULFILMENT_ACCESS", allowed: "operations_fulfilment", denied: "staff_viewer" },
    { name: "PLATFORM_ADMIN_ACCESS", allowed: "super_admin", denied: "specialist" },
    {
      name: "LEGAL_ENTITY_PICKER_ACCESS",
      allowed: "catalogue_manager",
      denied: "content_marketing",
    },
  ];

  it.each(ACCESS_MATRIX)(
    "$name has documented allow and deny roles",
    ({ name, allowed, denied }) => {
      const requirement = adminAccess[name];
      expect(has(allowed, requirement)).toBe(true);
      expect(has(denied, requirement)).toBe(false);
    },
  );
});
