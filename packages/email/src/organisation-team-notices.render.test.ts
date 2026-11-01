import { describe, expect, it } from "vitest";
import { renderEmail } from "./render.js";

describe("access-requested-notice", () => {
  it("names who asked, for what and why, and links to Team", async () => {
    const rendered = await renderEmail("access-requested-notice", {
      recipientFirstName: "Maya",
      requesterName: "Tom Whitfield",
      entityName: "Northbank Gallery",
      requested: "the Buyer agent role",
      reason: "To bid in the November sale.",
      teamUrl: "https://lax.bid/team",
    });
    expect(rendered.subject).toBe("Tom Whitfield asked for access to Northbank Gallery");
    expect(rendered.text).toContain("Tom Whitfield asked for the Buyer agent role");
    expect(rendered.text).toContain("To bid in the November sale.");
    expect(rendered.html).toContain("https://lax.bid/team");
  });
});

describe("access-request-decided-notice", () => {
  it("tells the requester the role they now have", async () => {
    const rendered = await renderEmail("access-request-decided-notice", {
      recipientFirstName: "Tom",
      entityName: "Northbank Gallery",
      approved: true,
      grantedRole: "Buyer agent",
      note: null,
      workspaceUrl: "https://lax.bid/home",
    });
    expect(rendered.subject).toBe("Your access request for Northbank Gallery was approved");
    expect(rendered.text).toContain("You now have the Buyer agent role");
    expect(rendered.text).not.toContain("Their note");
  });

  it("passes on the decider's note when declined", async () => {
    const rendered = await renderEmail("access-request-decided-notice", {
      entityName: "Northbank Gallery",
      approved: false,
      note: "Ask Maya after the sale.",
      workspaceUrl: "https://lax.bid/home",
    });
    expect(rendered.subject).toBe("Your access request for Northbank Gallery was declined");
    expect(rendered.text).toContain("Ask Maya after the sale.");
  });
});

describe("two-step-reminder-notice", () => {
  it("says who asked and where to turn it on", async () => {
    const rendered = await renderEmail("two-step-reminder-notice", {
      recipientFirstName: "Sam",
      entityName: "Northbank Gallery",
      senderName: "Maya Okafor",
      required: false,
      securityUrl: "https://account.lax.uk/security",
    });
    expect(rendered.subject).toBe("Northbank Gallery asks you to turn on two-step verification");
    expect(rendered.text).toContain("Maya Okafor at Northbank Gallery asked you");
    expect(rendered.text).not.toContain("requires it");
    expect(rendered.html).toContain("https://account.lax.uk/security");
  });

  it("says what waits when the organisation requires it", async () => {
    const rendered = await renderEmail("two-step-reminder-notice", {
      entityName: "Northbank Gallery",
      senderName: "Maya Okafor",
      required: true,
      securityUrl: "https://account.lax.uk/security",
    });
    expect(rendered.subject).toBe(
      "Turn on two-step verification to keep acting for Northbank Gallery",
    );
    expect(rendered.text).toContain("Northbank Gallery requires it");
  });
});
