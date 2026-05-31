import { describe, expect, it } from "vitest";
import { isFinanceAdminPath, isPlatformAdminPath } from "./staff-workspace-switcher";

describe("staff workspace route matching", () => {
  it("treats finance home and finance tools as finance routes", () => {
    expect(isFinanceAdminPath("/admin/finance")).toBe(true);
    expect(isFinanceAdminPath("/admin/finance/reports")).toBe(true);
    expect(isFinanceAdminPath("/admin/payments")).toBe(true);
    expect(isFinanceAdminPath("/admin/integrations/xero")).toBe(true);
  });

  it("excludes finance routes from the platform workspace", () => {
    expect(isPlatformAdminPath("/admin")).toBe(true);
    expect(isPlatformAdminPath("/admin/lots")).toBe(true);
    expect(isPlatformAdminPath("/admin/finance")).toBe(false);
    expect(isPlatformAdminPath("/admin/payments/manual-review")).toBe(false);
  });
});
