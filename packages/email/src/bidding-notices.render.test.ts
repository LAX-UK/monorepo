import { describe, expect, it } from "vitest";
import { renderEmail } from "./render.js";

describe("sale registration decision email", () => {
  it("renders an approval with the limit and a link to the sale", async () => {
    const rendered = await renderEmail("sale-registration-decision-notice", {
      userName: "Sam",
      saleTitle: "Autumn Sale",
      decision: "approved",
      bidLimit: "£5,000.00",
      saleUrl: "https://lax.bid/sales/autumn-sale/1",
      supportContactEmail: "help@lax.bid",
    });
    expect(rendered.subject).toBe("You can bid in Autumn Sale");
    for (const body of [rendered.html, rendered.text]) {
      expect(body).toContain("£5,000.00");
      expect(body).toContain("https://lax.bid/sales/autumn-sale/1");
    }
  });

  it("renders a decline with the staff reason and no link to bid", async () => {
    const rendered = await renderEmail("sale-registration-decision-notice", {
      userName: "Sam",
      saleTitle: "Autumn Sale",
      decision: "declined",
      reason: "Identity check incomplete.",
      saleUrl: "https://lax.bid/sales/autumn-sale/1",
      supportContactEmail: "help@lax.bid",
    });
    expect(rendered.subject).toBe("Your request to bid in Autumn Sale was declined");
    expect(rendered.text).toContain("Identity check incomplete.");
    expect(rendered.text).toContain("help@lax.bid");
    expect(rendered.text).not.toContain("View the sale");
  });
});

describe("bidding limit changed email", () => {
  it("shows both limits and names a removed limit", async () => {
    const rendered = await renderEmail("bidding-limit-changed-notice", {
      recipientFirstName: "Olu",
      scope: "organisation",
      scopeName: "Northbank Gallery",
      previousLimit: "£1,000.00",
      newLimit: null,
      supportContactEmail: "help@lax.bid",
    });
    expect(rendered.subject).toBe("The bidding limit for Northbank Gallery changed");
    expect(rendered.text).toContain("£1,000.00");
    expect(rendered.text).toContain("No limit");
    expect(rendered.text).toContain("Bids you have already placed stand");
  });
});

describe("payment failed email", () => {
  it("says what happened and links to checkout to pay again", async () => {
    const rendered = await renderEmail("payment-failed-notice", {
      userName: "Sam",
      lotTitle: "Harbour at Dusk",
      payUrl: "https://lax.bid/purchases/checkout/lot-1",
      supportContactEmail: "help@lax.bid",
    });
    expect(rendered.subject).toBe("Your payment for Harbour at Dusk did not go through");
    for (const body of [rendered.html, rendered.text]) {
      expect(body).toContain("https://lax.bid/purchases/checkout/lot-1");
    }
    expect(rendered.text).toContain("Pay again");
  });
});
