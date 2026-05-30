import { describe, expect, it } from "vitest";
import {
  humanizeStripeDisabledReason,
  isActionableStripeDisabledReason,
} from "./disabled-reason-labels.js";

describe("isActionableStripeDisabledReason", () => {
  it("returns true for past_due and pending_verification", () => {
    expect(isActionableStripeDisabledReason("requirements.past_due")).toBe(true);
    expect(isActionableStripeDisabledReason("requirements.pending_verification")).toBe(true);
    expect(isActionableStripeDisabledReason("under_review")).toBe(true);
  });

  it("returns false for hard blocks", () => {
    expect(isActionableStripeDisabledReason("rejected.fraud")).toBe(false);
    expect(isActionableStripeDisabledReason("platform_paused")).toBe(false);
    expect(isActionableStripeDisabledReason(null)).toBe(false);
  });
});

describe("humanizeStripeDisabledReason", () => {
  it("maps past_due to user-friendly copy", () => {
    const label = humanizeStripeDisabledReason("requirements.past_due");
    expect(label.label).toBe("Overdue payout details");
    expect(label.severity).toBe("warning");
  });

  it("maps rejected.fraud to support copy", () => {
    const label = humanizeStripeDisabledReason("rejected.fraud");
    expect(label.label).toBe("Account blocked");
    expect(label.severity).toBe("error");
  });
});
