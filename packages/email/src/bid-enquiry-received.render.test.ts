import { describe, expect, it } from "vitest";
import { emailProductFor } from "./email-product.js";
import { renderEmail } from "./render.js";

const base = {
  reference: "E-1042",
  recipientName: "Daniel Price",
  replyBy: "2026-11-04T10:30:00.000Z",
  privacyUrl: "https://lax.bid/privacy",
  contactEmail: "info@lax.bid",
};

describe("bid-enquiry-received", () => {
  it("acknowledges a seller with the reference, reply date and a short summary", async () => {
    const email = await renderEmail("bid-enquiry-received", {
      ...base,
      kind: "sell",
      departmentLabel: "Paintings",
      work: "Iris Calder, Low tide at Maldon",
      photoCount: 2,
    });
    expect(email.subject).toBe("We have your enquiry (E-1042)");
    expect(email.text).toContain("Dear Daniel,");
    expect(email.text).toContain("selling a work privately");
    expect(email.text).toContain("paintings team");
    expect(email.text).toContain("within two business days, by Wednesday 4 November");
    for (const row of [
      "E-1042",
      "Sell privately",
      "Paintings",
      "Iris Calder, Low tide at Maldon",
      "2 received",
    ]) {
      expect(email.text).toContain(row);
    }
    expect(email.text).toContain("in confidence");
    expect(email.text).toContain("info@lax.bid");
    expect(email.html).toContain("https://lax.bid/privacy");
  });

  it("acknowledges a buyer without a department or a work", async () => {
    const email = await renderEmail("bid-enquiry-received", { ...base, kind: "buy" });
    expect(email.text).toContain("buying privately");
    expect(email.text).toContain("Buy privately");
    expect(email.text).not.toContain("Department");
    expect(email.text).not.toContain("Photos");
  });

  it("acknowledges a contact form message by its topic", async () => {
    const email = await renderEmail("bid-enquiry-received", {
      ...base,
      kind: "general",
      topicLabel: "Press",
    });
    expect(email.text).toContain("Thank you for getting in touch");
    expect(email.text).toContain("Press");
    expect(email.text).not.toContain("in confidence");
  });

  it("never carries a price or photo addresses", async () => {
    const email = await renderEmail("bid-enquiry-received", {
      ...base,
      kind: "sell",
      departmentLabel: "Paintings",
      work: "Iris Calder, Low tide at Maldon",
      photoCount: 3,
    });
    expect(email.text).not.toMatch(/£|price|https?:\/\/[^\s]*\.(jpe?g|png|webp)/i);
    expect(email.html).not.toContain('<img src="https://');
  });

  it("names London Auction Xchange LTD and its address, never the art company", async () => {
    const email = await renderEmail("bid-enquiry-received", { ...base, kind: "sell" });
    expect(email.text).toContain("London Auction Xchange LTD");
    expect(email.text).toContain("156 New Cavendish Street");
    expect(email.text).not.toContain("London Art Exchange");
  });

  it("greets a sender with no name by a plain hello", async () => {
    const email = await renderEmail("bid-enquiry-received", {
      ...base,
      recipientName: undefined,
      kind: "buy",
    });
    expect(email.text).toContain("Hello,");
  });

  it("is sent by LAX Bid", () => {
    expect(emailProductFor("bid-enquiry-received", { ...base, kind: "buy" })).toBe("bid");
  });
});
