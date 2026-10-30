import { describe, expect, it } from "vitest";
import { renderEmail } from "./render.js";

describe("payout-bank-changed-notice", () => {
  it("names the organisation and the new account, calmly", async () => {
    const rendered = await renderEmail("payout-bank-changed-notice", {
      userName: "Ada",
      entityName: "Northbank Gallery",
      bankLast4: "4242",
      payoutsUrl: "https://lax.bid/organisation/payouts",
    });
    expect(rendered.subject).toBe("The payout bank account for Northbank Gallery changed");
    expect(rendered.text).toContain("Account ending 4242");
    expect(rendered.text).toContain("If nobody did, contact us straight away");
    expect(rendered.html).toContain("https://lax.bid/organisation/payouts");
  });

  it("leaves the account line out when Stripe gave no digits", async () => {
    const rendered = await renderEmail("payout-bank-changed-notice", {
      userName: "Ada",
      entityName: "Northbank Gallery",
      bankLast4: null,
      payoutsUrl: "https://lax.bid/organisation/payouts",
    });
    expect(rendered.text).not.toContain("Account ending");
  });
});
