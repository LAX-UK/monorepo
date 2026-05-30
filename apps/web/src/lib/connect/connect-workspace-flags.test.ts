import type { ConnectGapState } from "@auction/connect";
import { describe, expect, it } from "vitest";
import { deriveConnectWorkspaceFlags } from "./connect-workspace-flags";

const baseGap: Pick<ConnectGapState, "missing" | "canReceivePayouts" | "canPublish"> = {
  missing: [],
  canReceivePayouts: false,
  canPublish: false,
};

describe("deriveConnectWorkspaceFlags", () => {
  it("shows onboarding form and compact header for owner with requirements_due", () => {
    const flags = deriveConnectWorkspaceFlags({
      memberRole: "owner",
      gap: { ...baseGap, stage: "requirements_due", disabledReason: null },
      stripeActionRequired: 0,
    });
    expect(flags.showOnboardingForm).toBe(true);
    expect(flags.useCompactHeader).toBe(true);
    expect(flags.showFinanceReadOnly).toBe(false);
  });

  it("hides onboarding form for owner on restricted stage", () => {
    const flags = deriveConnectWorkspaceFlags({
      memberRole: "owner",
      gap: {
        ...baseGap,
        stage: "restricted",
        disabledReason: "rejected.fraud",
      },
      stripeActionRequired: 0,
    });
    expect(flags.showOnboardingForm).toBe(false);
    expect(flags.showManagement).toBe(false);
  });

  it("shows finance read-only and hides onboarding form for finance on requirements_due", () => {
    const flags = deriveConnectWorkspaceFlags({
      memberRole: "finance",
      gap: { ...baseGap, stage: "requirements_due", disabledReason: null },
      stripeActionRequired: 0,
    });
    expect(flags.showFinanceReadOnly).toBe(true);
    expect(flags.showOnboardingForm).toBe(false);
    expect(flags.useCompactHeader).toBe(false);
  });

  it("shows management panel for owner when ready", () => {
    const flags = deriveConnectWorkspaceFlags({
      memberRole: "owner",
      gap: { ...baseGap, stage: "ready", canReceivePayouts: true, canPublish: true },
      stripeActionRequired: 0,
    });
    expect(flags.showManagement).toBe(true);
    expect(flags.showOnboardingForm).toBe(false);
  });

  it("uses compact header when Stripe banner reports actionRequired", () => {
    const flags = deriveConnectWorkspaceFlags({
      memberRole: "owner",
      gap: { ...baseGap, stage: "onboarding_incomplete" },
      stripeActionRequired: 2,
    });
    expect(flags.useCompactHeader).toBe(true);
  });
});
