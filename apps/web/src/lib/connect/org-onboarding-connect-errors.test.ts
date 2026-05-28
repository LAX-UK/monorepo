import { describe, expect, it } from "vitest";
import { humanizeOrgConnectStepError } from "./org-onboarding-connect-errors";

describe("humanizeOrgConnectStepError", () => {
  it("maps connect API codes to staff-friendly copy", () => {
    expect(humanizeOrgConnectStepError("connect_not_started")).toContain("embedded form");
    expect(humanizeOrgConnectStepError("connect_requirements_pending")).toContain("few details");
    expect(humanizeOrgConnectStepError("connect_not_complete")).toContain("Refresh status");
    expect(humanizeOrgConnectStepError("connect_sync_failed")).toContain("Refresh status");
    expect(humanizeOrgConnectStepError("stripe_not_configured")).toContain(
      "temporarily unavailable",
    );
    expect(humanizeOrgConnectStepError("insufficient_role")).toContain("owner or admin");
  });

  it("falls back for unknown codes", () => {
    expect(humanizeOrgConnectStepError("unknown_code")).toContain("unknown code");
    expect(humanizeOrgConnectStepError(null)).toContain("Finish payout setup first");
  });
});
