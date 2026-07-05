import { describe, expect, it } from "vitest";
import {
  STRIPE_ACCOUNT_DISABLED_REASONS,
  humanizeStripeDisabledReason,
  isActionableStripeDisabledReason,
  isStripeAccountDisabledReason,
} from "./disabled-reason-labels.js";

describe("STRIPE_ACCOUNT_DISABLED_REASONS", () => {
  it("covers every documented Stripe Account disabled_reason enum value", () => {
    expect(STRIPE_ACCOUNT_DISABLED_REASONS).toHaveLength(15);
    for (const code of STRIPE_ACCOUNT_DISABLED_REASONS) {
      expect(isStripeAccountDisabledReason(code)).toBe(true);
      const label = humanizeStripeDisabledReason(code);
      expect(label.label.length).toBeGreaterThan(0);
      expect(label.hint.length).toBeGreaterThan(0);
    }
  });
});

describe("isActionableStripeDisabledReason", () => {
  it("returns true for past_due and pending_verification", () => {
    expect(isActionableStripeDisabledReason("requirements.past_due")).toBe(true);
    expect(isActionableStripeDisabledReason("requirements.pending_verification")).toBe(true);
    expect(isActionableStripeDisabledReason("under_review")).toBe(true);
  });

  it("returns false for hard blocks and platform-only actions", () => {
    expect(isActionableStripeDisabledReason("rejected.fraud")).toBe(false);
    expect(isActionableStripeDisabledReason("platform_paused")).toBe(false);
    expect(isActionableStripeDisabledReason("action_required.requested_capabilities")).toBe(false);
    expect(isActionableStripeDisabledReason(null)).toBe(false);
  });
});

describe("humanizeStripeDisabledReason", () => {
  it("maps past_due to user-friendly copy aligned with Stripe docs", () => {
    const label = humanizeStripeDisabledReason("requirements.past_due");
    expect(label.label).toBe("Overdue payout details");
    expect(label.severity).toBe("warning");
  });

  it("maps rejected.fraud with specific doc wording", () => {
    const label = humanizeStripeDisabledReason("rejected.fraud");
    expect(label.label).toBe("Account rejected (fraud)");
    expect(label.severity).toBe("error");
  });

  it("maps platform-specific rejection reasons", () => {
    expect(humanizeStripeDisabledReason("rejected.platform_fraud").label).toBe(
      "Account rejected by platform (fraud)",
    );
    expect(humanizeStripeDisabledReason("rejected.incomplete_verification").label).toBe(
      "Account rejected (incomplete verification)",
    );
  });
});
