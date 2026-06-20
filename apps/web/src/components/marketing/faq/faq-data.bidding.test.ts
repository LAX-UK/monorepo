import { describe, expect, it } from "vitest";
import { faqItems } from "./faq-data";

function findFaq(id: string) {
  const item = faqItems.find((entry) => entry.id === id);
  if (!item) throw new Error(`FAQ item ${id} not found`);
  return item;
}

describe("faq bidding copy", () => {
  it("does not claim anti-snipe extends by 2 minutes", () => {
    const bidding = findFaq("how-bidding-works");
    expect(bidding.body).not.toMatch(/extends.*by 2 minutes/i);
    expect(bidding.body).toContain("30 seconds");
  });

  it("dedicated closing-extension FAQ explains per-lot rule without jargon", () => {
    const extensions = findFaq("lot-closing-extensions");
    expect(extensions.title).toMatch(/stay open/i);
    expect(extensions.body).toContain("final 2 minutes");
    expect(extensions.body).toContain("30 seconds");
    expect(extensions.body).toContain("that lot only");
    expect(extensions.body).not.toMatch(/snip/i);
  });

  it("states onsite sales have no web bidding", () => {
    const bidding = findFaq("how-bidding-works");
    expect(bidding.body).toContain("not through the website");
  });

  it("advance bids distinguish online max bids from onsite requests", () => {
    const advance = findFaq("advance-bids");
    expect(advance.body).toContain("auto-bid");
    expect(advance.body).toContain("absentee bid request");
    expect(advance.body).toContain("do not accept web bids");
  });

  it("verification FAQ does not require verification before every first step", () => {
    const verification = findFaq("verification-before-bidding");
    expect(verification.body).not.toMatch(/only verified users are permitted/i);
    expect(verification.body).toContain("not always completed before your first registration step");
  });
});
