import { shouldShowConnectPageAlert } from "@/lib/connect/seller-compliance-chrome.server";
import { describe, expect, it } from "vitest";

describe("shouldShowConnectPageAlert", () => {
  it("hides page alert when compliance strip shows payout setup needed", () => {
    expect(
      shouldShowConnectPageAlert(
        {
          showStrip: true,
          payoutSetup: { ready: false, href: "/dashboard/seller/connect" },
        },
        { showBanner: true },
      ),
    ).toBe(false);
  });

  it("shows page alert when connect is required but strip is hidden", () => {
    expect(
      shouldShowConnectPageAlert({ showStrip: false, payoutSetup: null }, { showBanner: true }),
    ).toBe(true);
  });

  it("hides when connect presentation has no banner", () => {
    expect(
      shouldShowConnectPageAlert(
        { showStrip: true, payoutSetup: { ready: false, href: "/dashboard/seller/connect" } },
        { showBanner: false },
      ),
    ).toBe(false);
  });
});
