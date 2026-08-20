import type { AdminUserReadinessSnapshot } from "@/lib/admin/admin-user-readiness.vm";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AdminUserReadinessPanel } from "./admin-user-readiness-panel";

const snapshot: AdminUserReadinessSnapshot = {
  identity: {
    emailVerified: true,
    kycStatus: "approved",
    securityStatusAvailable: false,
    twoFactorEnabled: false,
  },
  compliance: {
    amlHoldActive: false,
    amlReviewPending: false,
    latestAmlDecision: null,
  },
  commerce: {
    legalEntityCount: 0,
    connectGapsCount: 0,
    lotsWon: 0,
    lifetimeSpendLabel: "—",
  },
  nextAction: {
    label: "Ready — no blocking issues",
    href: "?tab=overview",
    tone: "ready",
  },
};

describe("AdminUserReadinessPanel", () => {
  it("renders unavailable rather than claiming 2FA is off", () => {
    render(<AdminUserReadinessPanel snapshot={snapshot} />);

    expect(screen.getByText("2FA unavailable")).toBeInTheDocument();
    expect(screen.queryByText("2FA off")).not.toBeInTheDocument();
  });
});
