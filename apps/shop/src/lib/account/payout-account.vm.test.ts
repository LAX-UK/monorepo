import { describe, expect, it } from "vitest";
import { buildPayoutAccountViewModel } from "./payout-account.vm";

const base = {
  stripeAccountId: "acct_1",
  chargesEnabled: false,
  payoutsEnabled: true,
  requirementsCurrentlyDue: [],
  disabledReason: null,
  ready: true,
};

describe("buildPayoutAccountViewModel", () => {
  it("asks to set up when no account exists", () => {
    const vm = buildPayoutAccountViewModel({ ...base, stripeAccountId: null, ready: false });
    expect(vm).toMatchObject({ stage: "not_started", surface: "onboarding" });
    expect(vm.description).toMatch(/separate from any LAX\.bid/);
  });

  it("treats a missing status as not started", () => {
    expect(buildPayoutAccountViewModel(null).stage).toBe("not_started");
  });

  it("asks to continue onboarding while requirements are due", () => {
    const vm = buildPayoutAccountViewModel({
      ...base,
      ready: false,
      requirementsCurrentlyDue: ["external_account"],
    });
    expect(vm).toMatchObject({ stage: "action_required", tone: "warning", surface: "onboarding" });
  });

  it("explains paused payouts when Stripe reports a disabled reason", () => {
    const vm = buildPayoutAccountViewModel({
      ...base,
      ready: false,
      disabledReason: "requirements.past_due",
    });
    expect(vm.description).toMatch(/paused/);
  });

  it("offers account management once ready", () => {
    expect(buildPayoutAccountViewModel(base)).toMatchObject({
      stage: "ready",
      tone: "success",
      surface: "management",
    });
  });
});
