import { describe, expect, it } from "vitest";
import { connectReadyFromCachedEntity } from "./connect-shared.js";

describe("connectReadyFromCachedEntity", () => {
  const base = {
    stripeConnectAccountId: "acct_1",
    stripeConnectPayoutsEnabled: true,
    stripeConnectRequirementsCurrentlyDue: [] as string[],
    stripeConnectDisabledReason: null,
  };

  it("returns false when disabled reason is set", () => {
    expect(
      connectReadyFromCachedEntity({
        ...base,
        stripeConnectDisabledReason: "requirements.past_due",
      } as never),
    ).toBe(false);
  });

  it("returns false when requirements are due", () => {
    expect(
      connectReadyFromCachedEntity({
        ...base,
        stripeConnectRequirementsCurrentlyDue: ["external_account"],
      } as never),
    ).toBe(false);
  });

  it("returns true when payouts enabled with no blockers", () => {
    expect(connectReadyFromCachedEntity(base as never)).toBe(true);
  });
});
