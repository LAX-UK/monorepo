import { describe, expect, it } from "vitest";
import { buildAdminUserListOrderBy, buildAdminUserListWhere } from "./admin-user-list-sql.js";

describe("admin-user-list-sql", () => {
  it("builds where clause for email and KYC filters", () => {
    const clause = buildAdminUserListWhere({
      limit: 25,
      offset: 0,
      emailVerified: true,
      kycStatus: "approved",
      accountStatus: "active",
    });
    expect(clause).toBeDefined();
  });

  it("returns undefined when no filters", () => {
    expect(buildAdminUserListWhere({ limit: 25, offset: 0 })).toBeUndefined();
  });

  it("builds order by for each sort key", () => {
    expect(buildAdminUserListOrderBy("name_asc")).toBeDefined();
    expect(buildAdminUserListOrderBy("last_active_desc")).toBeDefined();
    expect(buildAdminUserListOrderBy(undefined)).toBeDefined();
  });
});
