import { describe, expect, it } from "vitest";
import { connectReadyFromCachedEntity } from "./connect-shared.js";

describe("connectReadyFromCachedEntity", () => {
  const base = {
    stripeConnectAccountId: "acct_1",
    stripeConnectPayoutsEnabled: true,
    stripeConnectRequirementsCurrentlyDue: [] as string[],
    stripeConnectRequirementsErrors: [],
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

  it("returns false when validation errors persist without currently_due keys", () => {
    expect(
      connectReadyFromCachedEntity({
        ...base,
        stripeConnectRequirementsErrors: [
          {
            requirement: "company.tax_id",
            code: "invalid_tax_id_format",
            reason: "Tax IDs must be a unique set of 9 numbers without dashes.",
          },
        ],
      } as never),
    ).toBe(false);
  });

  it("returns true when payouts enabled with no blockers", () => {
    expect(connectReadyFromCachedEntity(base as never)).toBe(true);
  });
});
