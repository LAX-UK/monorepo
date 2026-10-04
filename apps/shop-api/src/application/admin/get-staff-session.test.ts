import { describe, expect, it } from "vitest";
import { getStaffSessionView } from "./get-staff-session.js";

describe("getStaffSessionView", () => {
  it("maps role capabilities and feature flags", () => {
    const view = getStaffSessionView({
      subject: "sub-1",
      role: "finance",
      featureFlags: {
        read: () => ({
          payouts: true,
          thirdPartySales: false,
          originalSales: false,
          merchandise: false,
        }),
      },
    });
    expect(view.subject).toBe("sub-1");
    expect(view.capabilities).toContain("payout.mark_paid");
    expect(view.features.payouts).toBe(true);
  });
});
