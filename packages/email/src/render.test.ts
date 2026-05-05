import { describe, expect, it } from "vitest";
import { renderEmail } from "./render.js";

describe("renderEmail", () => {
  it("renders auth templates to html and plaintext", async () => {
    const rendered = await renderEmail("verify-email", {
      verificationUrl: "https://lax.bid/verify",
      userName: "Ada",
    });

    expect(rendered.subject).toBe("Verify your London Art Exchange email");
    expect(rendered.html).toContain("Verify your email");
    expect(rendered.text).toContain("Confirm this email address");
  });

  it("renders opt-outable notification templates with unsubscribe copy", async () => {
    const rendered = await renderEmail("bid-outbid", {
      userName: "Ada",
      lotTitle: "Untitled",
      lotUrl: "https://lax.bid/artwork/lot",
      currentBid: "GBP 100",
      unsubscribeUrl: "https://lax.bid/unsubscribe?t=token",
    });

    expect(rendered.subject).toBe("You've been outbid");
    expect(rendered.html).toContain("Unsubscribe from this notification type");
    expect(rendered.text).toContain("GBP 100");
  });
});
