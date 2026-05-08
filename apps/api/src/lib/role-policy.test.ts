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

  it("grants artist admin capabilities only to administrator", () => {
    expect(roleHasCapability("administrator", "artist.read")).toBe(true);
    expect(roleHasCapability("administrator", "artist.review")).toBe(true);
    expect(roleHasCapability("administrator", "artist.merge")).toBe(true);
    expect(roleHasCapability("accountant", "artist.read")).toBe(false);
    expect(roleHasCapability("client", "artist.merge")).toBe(false);
  });

  it("grants payout.read and payout.process to administrator and accountant", () => {
    expect(roleHasCapability("administrator", "payout.read")).toBe(true);
    expect(roleHasCapability("administrator", "payout.process")).toBe(true);
    expect(roleHasCapability("accountant", "payout.read")).toBe(true);
    expect(roleHasCapability("accountant", "payout.process")).toBe(true);
    expect(roleHasCapability("client", "payout.read")).toBe(false);
  });

  it("reserves payout.reverse and audit.read_pii for administrator only", () => {
    expect(roleHasCapability("administrator", "payout.reverse")).toBe(true);
    expect(roleHasCapability("accountant", "payout.reverse")).toBe(false);
    expect(roleHasCapability("administrator", "audit.read_pii")).toBe(true);
    expect(roleHasCapability("accountant", "audit.read_pii")).toBe(false);
  });
});
