import { describe, expect, it } from "vitest";
import { isPayeeConnectReady } from "./payee-connect-readiness.js";

const ready = { payoutsEnabled: true, requirementsCurrentlyDue: [], disabledReason: null };

describe("isPayeeConnectReady", () => {
  it("is ready when payouts are enabled with nothing due", () => {
    expect(isPayeeConnectReady(ready)).toBe(true);
  });

  it("is not ready while payouts are disabled", () => {
    expect(isPayeeConnectReady({ ...ready, payoutsEnabled: false })).toBe(false);
  });

  it("is not ready while requirements are due", () => {
    expect(isPayeeConnectReady({ ...ready, requirementsCurrentlyDue: ["external_account"] })).toBe(
      false,
    );
  });

  it("is not ready when Stripe reports a disabled reason", () => {
    expect(isPayeeConnectReady({ ...ready, disabledReason: "requirements.past_due" })).toBe(false);
  });
});
