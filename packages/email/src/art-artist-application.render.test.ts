import { describe, expect, it } from "vitest";
import { renderEmail } from "./render.js";

const APPLICATION_URL = "https://lax.art/for-artists/apply";

describe("artist application emails", () => {
  it("confirms a sent application with its reference and the reply time", async () => {
    const email = await renderEmail("art-artist-application-received", {
      artistName: "Ada Moreno",
      reference: "LAX-AP-10001",
      replyWeeks: 4,
      applicationUrl: APPLICATION_URL,
    });
    expect(email.subject).toBe("We have your application (LAX-AP-10001)");
    expect(email.text).toContain("Hi Ada Moreno,");
    expect(email.text).toContain("LAX-AP-10001");
    expect(email.text).toContain("We reply within 4 weeks");
    expect(email.html).toContain(APPLICATION_URL);
    // lax.art mail names London Art Exchange, never the Bid company.
    expect(email.text).toContain("London Art Exchange Ltd");
    expect(email.text).not.toContain("London Auction Xchange");
  });

  it("carries the gallery's question", async () => {
    const email = await renderEmail("art-artist-application-more-info", {
      artistName: "Ada Moreno",
      reference: "LAX-AP-10001",
      message: "Could you add the frame sizes?",
      applicationUrl: APPLICATION_URL,
    });
    expect(email.subject).toBe("A question about your application (LAX-AP-10001)");
    expect(email.text).toContain("Could you add the frame sizes?");
    expect(email.text).toContain("Thank you for your application (LAX-AP-10001)");
  });

  it("gives the reason for a decline and the date to apply again", async () => {
    const email = await renderEmail("art-artist-application-declined", {
      artistName: "Ada Moreno",
      reference: "LAX-AP-10001",
      reason: "Our programme is full this year.",
      reapplyFrom: "28 April 2027",
      applicationUrl: APPLICATION_URL,
    });
    expect(email.text).toContain("Our programme is full this year.");
    expect(email.text).toContain("apply again from 28 April 2027");
    expect(email.text).toContain("application (LAX-AP-10001)");
  });

  it("welcomes an accepted artist with a link to the portal", async () => {
    const email = await renderEmail("art-artist-application-welcome", {
      artistName: "Ada Moreno",
      reference: "LAX-AP-10001",
      portalUrl: "https://lax.art/for-artists/portal",
    });
    expect(email.subject).toBe("Welcome to London Art Exchange");
    expect(email.html).toContain("https://lax.art/for-artists/portal");
    expect(email.text).toContain("Open the artist portal");
  });
});
