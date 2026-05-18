import { describe, expect, it } from "vitest";
import {
  adminUserDetailPath,
  adminUsersListRedirectTarget,
  buildAdminUsersLegacyListRedirect,
} from "./admin-user-redirect";

describe("admin-user-redirect", () => {
  it("routes legacy list to staff when role=staff", () => {
    expect(adminUsersListRedirectTarget("staff")).toBe("/admin/staff");
    expect(adminUsersListRedirectTarget(undefined)).toBe("/admin/clients");
    expect(adminUsersListRedirectTarget("client")).toBe("/admin/clients");
  });

  it("preserves query params except role on legacy list redirect", () => {
    expect(
      buildAdminUsersLegacyListRedirect({
        role: "staff",
        q: "ada",
        suspended: "1",
      }),
    ).toBe("/admin/staff?q=ada&suspended=1");
  });

  it("maps detail path by role", () => {
    expect(adminUserDetailPath("staff", "u-1")).toBe("/admin/staff/u-1");
    expect(adminUserDetailPath("client", "u-1")).toBe("/admin/clients/u-1");
  });
});
