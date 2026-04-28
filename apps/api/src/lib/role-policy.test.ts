import {
  canAccessFinanceAdminRoutes,
  canAccessPlatformAdminRoutes,
  roleHasCapability,
} from "@auction/types";
import { describe, expect, it } from "vitest";

describe("role policy", () => {
  it("grants platform admin only to administrator", () => {
    expect(canAccessPlatformAdminRoutes("administrator")).toBe(true);
    expect(canAccessPlatformAdminRoutes("accountant")).toBe(false);
    expect(canAccessPlatformAdminRoutes("client")).toBe(false);
  });

  it("grants finance access to administrator and accountant", () => {
    expect(canAccessFinanceAdminRoutes("administrator")).toBe(true);
    expect(canAccessFinanceAdminRoutes("accountant")).toBe(true);
    expect(canAccessFinanceAdminRoutes("client")).toBe(false);
  });

  it("only clients can bid or submit as buyer/seller flows", () => {
    expect(roleHasCapability("client", "bid.place")).toBe(true);
    expect(roleHasCapability("administrator", "bid.place")).toBe(false);
    expect(roleHasCapability("accountant", "bid.place")).toBe(false);
  });
});
