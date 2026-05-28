import { isDashboardListRoute, isDashboardOrgDetailRoute } from "@/lib/dashboard/list-routes";
import { describe, expect, it } from "vitest";

describe("list-routes", () => {
  it("treats verify-identity and checkout as compact banner routes", () => {
    expect(isDashboardListRoute("/dashboard/verify-identity")).toBe(true);
    expect(isDashboardListRoute("/dashboard/checkout")).toBe(true);
    expect(isDashboardListRoute("/dashboard/checkout/lot-id")).toBe(true);
  });

  it("detects org detail routes for banner suppression", () => {
    expect(isDashboardOrgDetailRoute("/dashboard/organisations/abc/members")).toBe(true);
    expect(isDashboardOrgDetailRoute("/dashboard/organisations")).toBe(false);
  });
});
