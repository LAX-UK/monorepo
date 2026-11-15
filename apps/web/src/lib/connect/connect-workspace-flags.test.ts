import type { ConnectGapState } from "@auction/connect";
import { describe, expect, it } from "vitest";
import {
  canManageConnect,
  canOnboard,
  deriveConnectWorkspaceFlags,
} from "./connect-workspace-flags";

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
    expect(flags.showPreparingPanel).toBe(true);
  });

  it("hides embedded panels for owner on restricted stage with account", () => {
    const flags = deriveConnectWorkspaceFlags({
      memberRole: "owner",
      gap: {
        ...baseGap,
        stage: "restricted",
        disabledReason: "rejected.fraud",
      },
      stripeActionRequired: 0,
      hasStripeAccount: true,
    });
    expect(flags.showOnboardingForm).toBe(false);
    expect(flags.showManagement).toBe(false);
    expect(flags.showEmbeddedPanels).toBe(false);
    expect(flags.showRestrictedPanel).toBe(true);
    expect(flags.showPreparingPanel).toBe(false);
  });

  it("shows finance read-only and awaiting owner without stripe account", () => {
    const flags = deriveConnectWorkspaceFlags({
      memberRole: "finance",
      gap: { ...baseGap, stage: "requirements_due", disabledReason: null },
      stripeActionRequired: 0,
      hasStripeAccount: false,
    });
    expect(flags.showFinanceReadOnly).toBe(true);
    expect(flags.showFinanceAwaitingOwner).toBe(true);
    expect(flags.showOnboardingForm).toBe(false);
    expect(flags.showRefreshAction).toBe(false);
    expect(flags.showPreparingPanel).toBe(false);
  });

  it("allows finance refresh when stripe account exists", () => {
    const flags = deriveConnectWorkspaceFlags({
      memberRole: "finance",
      gap: { ...baseGap, stage: "requirements_due", disabledReason: null },
      stripeActionRequired: 0,
      hasStripeAccount: true,
    });
    expect(flags.showRefreshAction).toBe(true);
    expect(flags.showFinanceAwaitingOwner).toBe(false);
    expect(flags.showManagement).toBe(true);
    expect(flags.showEmbeddedPanels).toBe(true);
  });

  it("shows management panel for owner when ready", () => {
    const flags = deriveConnectWorkspaceFlags({
      memberRole: "owner",
      gap: { ...baseGap, stage: "ready", canReceivePayouts: true, canPublish: true },
      stripeActionRequired: 0,
      hasStripeAccount: true,
    });
    expect(flags.showManagement).toBe(true);
    expect(flags.showOnboardingForm).toBe(false);
    expect(flags.showPreparingPanel).toBe(false);
  });

  it("uses compact header when Stripe banner reports actionRequired", () => {
    const flags = deriveConnectWorkspaceFlags({
      memberRole: "owner",
      gap: { ...baseGap, stage: "onboarding_incomplete" },
      stripeActionRequired: 2,
    });
    expect(flags.useCompactHeader).toBe(true);
  });

  it("hides preparing panel when owner already has stripe account", () => {
    const flags = deriveConnectWorkspaceFlags({
      memberRole: "owner",
      gap: { ...baseGap, stage: "onboarding_incomplete" },
      stripeActionRequired: 0,
      hasStripeAccount: true,
    });
    expect(flags.showPreparingPanel).toBe(false);
  });
});

describe("Connect role checks", () => {
  const roles = ["owner", "admin", "finance", "consignor", "viewer", "buyer_agent"] as const;

  it("lets owners, admins and finance open the workspace", () => {
    expect(roles.filter(canManageConnect)).toEqual(["owner", "admin", "finance"]);
  });

  it("lets owners and admins complete onboarding", () => {
    expect(roles.filter(canOnboard)).toEqual(["owner", "admin"]);
  });

  it("gives finance the management view but never onboarding", () => {
    const gap = { ...baseGap, stage: "requirements_due" as const, disabledReason: null };
    for (const memberRole of roles) {
      const flags = deriveConnectWorkspaceFlags({
        memberRole,
        gap,
        stripeActionRequired: 0,
        hasStripeAccount: true,
      });
      expect(flags.showRefreshAction).toBe(
        memberRole !== "consignor" && memberRole !== "viewer" && memberRole !== "buyer_agent",
      );
      expect(flags.showManagement).toBe(memberRole === "finance");
      expect(flags.canCompleteOnboarding).toBe(memberRole === "owner" || memberRole === "admin");
    }
  });
});
