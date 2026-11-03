import { KYC_DECLINED_COPY } from "@auction/branding";
import { describe, expect, it } from "vitest";
import { renderEmail } from "./render.js";

describe("identity check outcome emails", () => {
  it("renders an approval that links to registering for a sale", async () => {
    const rendered = await renderEmail("kyc-approved", {
      userName: "Ada",
      registerUrl: "https://lax.bid/sales",
    });
    expect(rendered.subject).toContain("identity is verified");
    for (const body of [rendered.html, rendered.text]) {
      expect(body).toContain("Register for a sale");
      expect(body).toContain("https://lax.bid/sales");
    }
  });

  it("renders a decline with Try again and Contact us, and no provider reason", async () => {
    const rendered = await renderEmail("kyc-declined", {
      userName: "Ada",
      retryUrl: "https://lax.bid/verify-identity",
      contactUrl: "https://lax.bid/contact",
    });
    expect(rendered.subject).toBe("We couldn't verify your LAX.BID identity");
    for (const body of [rendered.html, rendered.text]) {
      expect(body).toContain(KYC_DECLINED_COPY.retryLabel);
      expect(body).toContain(KYC_DECLINED_COPY.contactLabel);
      expect(body).toContain("https://lax.bid/verify-identity");
      expect(body).toContain("https://lax.bid/contact");
      expect(body).not.toMatch(/reason code|veriff|9102/i);
    }
  });
});

describe("sale cancelled email", () => {
  const base = { userName: "Sam", saleTitle: "Autumn Sale", supportContactEmail: "help@lax.bid" };

  it("tells a bidder their bids are void", async () => {
    const rendered = await renderEmail("sale-cancelled-notice", { ...base, audience: "bidder" });
    expect(rendered.subject).toBe("Autumn Sale has been cancelled");
    expect(rendered.text).toContain("Autumn Sale");
    expect(rendered.text).toContain("Your bids are void.");
  });

  it("does not tell a watcher or consignor that bids are void", async () => {
    for (const audience of ["consignor", "other"] as const) {
      const rendered = await renderEmail("sale-cancelled-notice", { ...base, audience });
      expect(rendered.text).not.toContain("bids are void");
    }
  });
});
