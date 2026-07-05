import { describe, expect, it } from "vitest";
import { formatStripeConnectAccountForStaff } from "./stripe-account-staff-labels.js";

describe("formatStripeConnectAccountForStaff", () => {
  it("labels demo seed accounts with name and state", () => {
    const cedar = formatStripeConnectAccountForStaff("acct_seed_cedar_needs_info");
    expect(cedar.primary).toBe("Demo Connect account · Cedar");
    expect(cedar.secondary).toBe("Verification details needed");
    expect(cedar.environment).toBe("demo");
    expect(cedar.rawId).toBe("acct_seed_cedar_needs_info");

    const robert = formatStripeConnectAccountForStaff("acct_seed_robert_ready");
    expect(robert.primary).toBe("Demo Connect account · Robert");
    expect(robert.secondary).toBe("Ready for payouts");

    const crowley = formatStripeConnectAccountForStaff("acct_seed_crowley_rejected");
    expect(crowley.primary).toBe("Demo Connect account · Crowley");
    expect(crowley.secondary).toBe("Account rejected");
  });

  it("labels demo seed accounts without a known state suffix", () => {
    const harrington = formatStripeConnectAccountForStaff("acct_seed_harrington_advisors");
    expect(harrington.primary).toBe("Demo Connect account · Harrington Advisors");
    expect(harrington.secondary).toBeUndefined();
    expect(harrington.environment).toBe("demo");
  });

  it("masks live Stripe account ids", () => {
    const live = formatStripeConnectAccountForStaff("acct_1ABCDEFGHIJKLMN");
    expect(live.primary).toBe("Stripe Connect account");
    expect(live.secondary).toBe("····KLMN");
    expect(live.environment).toBe("live");
    expect(live.rawId).toBe("acct_1ABCDEFGHIJKLMN");
  });
});
