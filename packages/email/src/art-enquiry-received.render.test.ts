import { describe, expect, it } from "vitest";
import { renderEmail } from "./render.js";

describe("enquiry acknowledgement", () => {
  it("gives the reference, the work, what happens next and the gallery's lines", async () => {
    const email = await renderEmail("art-enquiry-received", {
      reference: "E-2041",
      recipientName: "Ada Moreno",
      topic: "artwork",
      artworkTitle: "Evening Thames",
      artworkUrl: "https://lax.art/artworks/evening-thames",
      storefront: "art",
    });
    expect(email.subject).toBe("We have your enquiry (E-2041)");
    expect(email.text).toContain("Hi Ada Moreno,");
    expect(email.text).toContain("E-2041");
    expect(email.text).toContain("Evening Thames");
    expect(email.text).toContain("replies within one working day");
    expect(email.text).toContain("+44 800 208 4800");
    expect(email.html).toContain("https://lax.art/artworks/evening-thames");
    // lax.art mail names London Art Exchange, never the Bid company.
    expect(email.text).toContain("London Art Exchange Ltd");
    expect(email.text).not.toContain("London Auction Xchange");
  });

  it("names the topic of a general enquiry and its own next step", async () => {
    const email = await renderEmail("art-enquiry-received", {
      reference: "E-2042",
      topic: "private_viewing",
      storefront: "art",
    });
    expect(email.text).toContain("Hi there,");
    expect(email.text).toContain("Private viewing");
    expect(email.text).toContain("We suggest a quiet time");
    expect(email.text).not.toContain("See the work");
  });
});
