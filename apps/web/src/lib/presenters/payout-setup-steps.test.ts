import { describe, expect, it } from "vitest";
import { payoutSetupSteps } from "./payout-setup-steps";

describe("payoutSetupSteps", () => {
  it("asks a personal seller to check their identity, then add bank details", () => {
    expect(payoutSetupSteps("personal", { identityChecked: false, payoutsReady: false })).toEqual([
      { id: "identity", label: "Check your identity", done: false },
      { id: "bank_details", label: "Add your bank details", done: false },
    ]);
  });

  it("marks the identity check done before payouts are ready", () => {
    const steps = payoutSetupSteps("personal", { identityChecked: true, payoutsReady: false });
    expect(steps.map((step) => step.done)).toEqual([true, false]);
  });

  it("asks an organisation for bank details and who runs it", () => {
    expect(
      payoutSetupSteps("organisation", { identityChecked: false, payoutsReady: false }).map(
        (step) => step.label,
      ),
    ).toEqual(["Add your bank details", "Confirm who runs the organisation"]);
  });

  it("is done once payouts are ready", () => {
    const steps = payoutSetupSteps("organisation", { identityChecked: false, payoutsReady: true });
    expect(steps.every((step) => step.done)).toBe(true);
  });
});
