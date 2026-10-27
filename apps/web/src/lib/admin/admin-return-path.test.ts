import { describe, expect, it } from "vitest";
import { adminReturnPath, isAdminPath } from "./admin-return-path";

describe("adminReturnPath", () => {
  it("returns staff to the admin page they were on, with its query", () => {
    expect(adminReturnPath("/admin/lots", "?status=draft&q=rolex")).toBe(
      "/admin/lots?status=draft&q=rolex",
    );
    expect(adminReturnPath("/admin/sales/b77e57cb", "")).toBe("/admin/sales/b77e57cb");
    expect(adminReturnPath("/admin", null)).toBe("/admin");
  });

  it("falls back to the admin home for unknown, non-admin or unsafe paths", () => {
    expect(adminReturnPath(null)).toBe("/admin");
    expect(adminReturnPath("/dashboard", "?x=1")).toBe("/admin");
    expect(adminReturnPath("/administrator")).toBe("/admin");
    expect(adminReturnPath("/admin/api/export")).toBe("/admin");
    expect(adminReturnPath("/admin/%2F%2Fevil.com")).toBe("/admin");
  });

  it("ignores a query that does not start with a question mark", () => {
    expect(adminReturnPath("/admin/lots", "status=draft")).toBe("/admin/lots");
  });
});

describe("isAdminPath", () => {
  it("matches the admin home and pages below it only", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/payments")).toBe(true);
    expect(isAdminPath("/admins")).toBe(false);
    expect(isAdminPath(undefined)).toBe(false);
  });
});
