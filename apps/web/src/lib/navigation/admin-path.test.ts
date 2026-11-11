import { describe, expect, it } from "vitest";
import { isAdminPath } from "./admin-path";

describe("isAdminPath", () => {
  it("matches the admin home and pages below it only", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/payments")).toBe(true);
    expect(isAdminPath("/admins")).toBe(false);
    expect(isAdminPath(undefined)).toBe(false);
  });
});
