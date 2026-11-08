import { describe, expect, it } from "vitest";
import { ShopContractParseError, parsePortalPayeeConnectStatus } from "./parse-public.js";
import { PortalPayeeConnectAccountSchema, PortalPayeeConnectStatusSchema } from "./portal-me.js";

const status = {
  accountLinked: true,
  chargesEnabled: true,
  payoutsEnabled: true,
  requirementsCurrentlyDue: [],
  disabledReason: null,
  ready: true,
};

describe("the seller's payout account contract", () => {
  it("has no field that can carry a Stripe account id", () => {
    for (const schema of [PortalPayeeConnectStatusSchema, PortalPayeeConnectAccountSchema]) {
      expect(Object.keys(schema.properties)).not.toContain("stripeAccountId");
    }
    expect(JSON.stringify(PortalPayeeConnectStatusSchema)).not.toContain("acct_");
  });

  it("reads whether an account is linked", () => {
    expect(parsePortalPayeeConnectStatus(status)).toEqual(status);
    expect(parsePortalPayeeConnectStatus({ ...status, accountLinked: false }).accountLinked).toBe(
      false,
    );
  });

  it("refuses the older shape that sent the id instead of the flag", () => {
    const { accountLinked: _linked, ...rest } = status;
    expect(() => parsePortalPayeeConnectStatus({ ...rest, stripeAccountId: "acct_1" })).toThrow(
      ShopContractParseError,
    );
  });
});
