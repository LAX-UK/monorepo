import { describe, expect, it } from "vitest";
import {
  getConnectGapState,
  isConnectOnboardingStage,
  isPastDueConnectGap,
  isSellerConnectReady,
  isStripeAccountConfigured,
  shouldSkipConnect,
  statusFromLegalEntityRow,
} from "./readiness.js";

const readyEntity = {
  status: "approved",
  stripeConnectAccountId: "acct_1",
  stripeConnectPayoutsEnabled: true,
  stripeConnectRequirementsCurrentlyDue: [],
  isLaxManaged: false,
};

describe("shouldSkipConnect", () => {
  it("returns true for LAX-managed entities", () => {
    expect(shouldSkipConnect({ isLaxManaged: true })).toBe(true);
  });

  it("returns false for standard sellers", () => {
    expect(shouldSkipConnect({ isLaxManaged: false })).toBe(false);
  });
});

describe("isStripeAccountConfigured", () => {
  it("requires payouts and empty requirements", () => {
    expect(isStripeAccountConfigured(readyEntity)).toBe(true);
    expect(
      isStripeAccountConfigured({
        ...readyEntity,
        stripeConnectRequirementsCurrentlyDue: ["external_account"],
      }),
    ).toBe(false);
  });

  it("skips LAX-managed entities", () => {
    expect(
      isStripeAccountConfigured({
        ...readyEntity,
        isLaxManaged: true,
        stripeConnectPayoutsEnabled: false,
      }),
    ).toBe(true);
  });

  it("returns false when payouts disabled", () => {
    expect(isStripeAccountConfigured({ ...readyEntity, stripeConnectPayoutsEnabled: false })).toBe(
      false,
    );
  });

  it("returns false when disabledReason is set even if requirements arrays are empty", () => {
    expect(
      isStripeAccountConfigured({
        ...readyEntity,
        stripeConnectDisabledReason: "requirements.past_due",
      }),
    ).toBe(false);
  });
});

describe("isSellerConnectReady", () => {
  it("requires approved status", () => {
    expect(isSellerConnectReady(readyEntity)).toBe(true);
    expect(isSellerConnectReady({ ...readyEntity, status: "connect_pending" })).toBe(false);
  });

  it("skips LAX-managed inventory", () => {
    expect(
      isSellerConnectReady({
        ...readyEntity,
        status: "lead",
        isLaxManaged: true,
        stripeConnectPayoutsEnabled: false,
      }),
    ).toBe(true);
  });
});

describe("statusFromLegalEntityRow", () => {
  it("maps entity row fields to connect status", () => {
    expect(
      statusFromLegalEntityRow({
        ...readyEntity,
        stripeConnectDisabledReason: null,
      }),
    ).toEqual({
      stripeAccountId: "acct_1",
      chargesEnabled: false,
      payoutsEnabled: true,
      requirementsCurrentlyDue: [],
      disabledReason: null,
      ready: true,
    });
  });

  it("includes stripeConnectChargesEnabled when present", () => {
    expect(
      statusFromLegalEntityRow({
        ...readyEntity,
        stripeConnectChargesEnabled: true,
      }).chargesEnabled,
    ).toBe(true);
  });
});

describe("isConnectOnboardingStage", () => {
  it("allows onboarding for in-progress setup stages", () => {
    expect(isConnectOnboardingStage("not_started")).toBe(true);
    expect(isConnectOnboardingStage("onboarding_incomplete")).toBe(true);
    expect(isConnectOnboardingStage("requirements_due")).toBe(true);
  });

  it("blocks onboarding for ready and restricted stages", () => {
    expect(isConnectOnboardingStage("ready")).toBe(false);
    expect(isConnectOnboardingStage("restricted")).toBe(false);
    expect(isConnectOnboardingStage("kyc_required")).toBe(false);
  });
});

describe("isPastDueConnectGap", () => {
  it("returns true when disabledReason is requirements.past_due", () => {
    expect(
      isPastDueConnectGap({
        stage: "requirements_due",
        missing: [],
        canReceivePayouts: false,
        canPublish: false,
        disabledReason: "requirements.past_due",
      }),
    ).toBe(true);
  });

  it("returns false for generic requirements_due without past_due reason", () => {
    expect(
      isPastDueConnectGap({
        stage: "requirements_due",
        missing: [],
        canReceivePayouts: false,
        canPublish: false,
        disabledReason: null,
      }),
    ).toBe(false);
  });
});

describe("getConnectGapState", () => {
  it("returns managed_by_lax for LAX inventory", () => {
    expect(getConnectGapState({ ...readyEntity, isLaxManaged: true }).stage).toBe("managed_by_lax");
  });

  it("returns restricted for rejected entities", () => {
    expect(getConnectGapState({ ...readyEntity, status: "rejected" }).stage).toBe("restricted");
  });

  it("returns requirements_due when stripeConnectDisabledReason is actionable past_due", () => {
    const gap = getConnectGapState({
      ...readyEntity,
      stripeConnectPayoutsEnabled: false,
      stripeConnectDisabledReason: "requirements.past_due",
      stripeConnectRequirementsCurrentlyDue: ["external_account"],
    });
    expect(gap.stage).toBe("requirements_due");
    expect(gap.disabledReason).toBe("requirements.past_due");
    expect(gap.missing[0]?.label).toBe("Overdue payout details");
    expect(gap.missing.some((m) => m.label === "Bank account")).toBe(true);
  });

  it("returns restricted when stripeConnectDisabledReason is a hard block", () => {
    const gap = getConnectGapState({
      ...readyEntity,
      stripeConnectDisabledReason: "rejected.fraud",
    });
    expect(gap.stage).toBe("restricted");
    expect(gap.missing[0]?.label).toBe("Account blocked");
  });

  it("returns kyc_required when kyc not approved", () => {
    expect(getConnectGapState(readyEntity, { kycApproved: false }).stage).toBe("kyc_required");
  });

  it("returns not_started without stripe account id", () => {
    expect(getConnectGapState({ ...readyEntity, stripeConnectAccountId: null }).stage).toBe(
      "not_started",
    );
  });

  it("returns onboarding_incomplete when payouts disabled with no due requirements", () => {
    expect(
      getConnectGapState({
        ...readyEntity,
        stripeConnectPayoutsEnabled: false,
        stripeConnectRequirementsCurrentlyDue: [],
      }).stage,
    ).toBe("onboarding_incomplete");
  });

  it("labels missing requirements", () => {
    const gap = getConnectGapState({
      ...readyEntity,
      stripeConnectPayoutsEnabled: false,
      stripeConnectRequirementsCurrentlyDue: ["external_account"],
    });
    expect(gap.stage).toBe("requirements_due");
    expect(gap.missing[0]?.label).toBe("Bank account");
  });

  it("returns ready when configured and distinguishes canPublish", () => {
    const readyGap = getConnectGapState(readyEntity);
    expect(readyGap.stage).toBe("ready");
    expect(readyGap.canReceivePayouts).toBe(true);
    expect(readyGap.canPublish).toBe(true);

    const pendingGap = getConnectGapState({ ...readyEntity, status: "connect_pending" });
    expect(pendingGap.stage).toBe("ready");
    expect(pendingGap.canReceivePayouts).toBe(true);
    expect(pendingGap.canPublish).toBe(false);
  });
});
