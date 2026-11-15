import { describe, expect, it } from "vitest";
import { renderEmail } from "./render.js";

const base = {
  userName: "Daniel Price",
  reference: "PP-1A2B3C4D",
  lotTitle: "Low tide at Maldon",
  purchaseUrl: "https://lax.bid/purchases/lot-1",
  contactEmail: "info@lax.bid",
};

describe("bid-purchase-problem-received", () => {
  it("confirms the report with its reference, lot and kind of problem", async () => {
    const email = await renderEmail("bid-purchase-problem-received", {
      ...base,
      categoryLabel: "Damaged",
    });
    expect(email.subject).toBe("We have your report (PP-1A2B3C4D)");
    expect(email.text).toContain("Hi Daniel Price,");
    for (const fact of ["PP-1A2B3C4D", "Low tide at Maldon", "Damaged", "info@lax.bid"]) {
      expect(email.text).toContain(fact);
    }
    expect(email.html).toContain("https://lax.bid/purchases/lot-1");
  });

  it("greets a buyer with no name", async () => {
    const email = await renderEmail("bid-purchase-problem-received", {
      ...base,
      userName: null,
      categoryLabel: "Other",
    });
    expect(email.text).toContain("Hi there,");
  });
});

describe("bid-purchase-problem-resolved", () => {
  it("tells the buyer the report is resolved and where to write if it is not", async () => {
    const email = await renderEmail("bid-purchase-problem-resolved", base);
    expect(email.subject).toBe("Your report is resolved (PP-1A2B3C4D)");
    expect(email.text).toContain("marked your report about Low tide at Maldon as resolved");
    expect(email.text).toContain("info@lax.bid");
    expect(email.html).toContain("https://lax.bid/purchases/lot-1");
  });
});
