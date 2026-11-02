import { describe, expect, it } from "vitest";
import { renderEmail } from "./render.js";
import { RECIPIENT_RESOLUTION } from "./types.js";

describe("visitor-alert-confirm", () => {
  it("renders the confirm link, its lifetime and an unsubscribe link, as LAX Bid mail", async () => {
    const rendered = await renderEmail("visitor-alert-confirm", {
      confirmUrl: "https://lax.bid/alerts/confirm?t=abc",
      expirationHours: 48,
      unsubscribeUrl: "https://lax.bid/alerts/unsubscribe?t=xyz",
    });
    expect(rendered.subject).toBe("Confirm your LAX Bid sale alerts");
    expect(rendered.text).toContain("https://lax.bid/alerts/confirm?t=abc");
    expect(rendered.text).toContain("48 hours");
    expect(rendered.text).toContain("https://lax.bid/alerts/unsubscribe?t=xyz");
    expect(rendered.text).toContain("London Auction Xchange");
  });

  it("is addressed from its snapshot, since the person has no account", () => {
    expect(RECIPIENT_RESOLUTION["visitor-alert-confirm"]).toBe("snapshot");
  });
});
