import { describe, expect, it } from "vitest";
import { renderEmail } from "./render.js";

const NOTICE = {
  userName: "Ada",
  newEmail: "ada.new@example.com",
  whenDisplay: "3 November 2026 at 14:05 GMT",
  deviceLabel: null,
  secureAccountUrl: "https://account.lax.bid/account/security",
} as const;

const CONFIRM = {
  userName: "Ada",
  oldEmail: "ada.old@example.com",
  newEmail: "ada.new@example.com",
  confirmationUrl: "https://account.lax.bid/account/email-change?t=signed.token",
  validForDays: 7,
} as const;

describe("staff-assisted email change emails", () => {
  it("tells the old address who is changing it, to what, and how to stop it", async () => {
    const rendered = await renderEmail("staff-email-change-notice", NOTICE);
    expect(rendered.subject).toBe("LAX client services are changing your account email");
    for (const body of [rendered.html, rendered.text]) {
      expect(body).toContain("ada.new@example.com");
      expect(body).toContain("signed out on every device");
      expect(body).toContain("https://account.lax.bid/account/security");
      expect(body).toContain("support@lax.bid");
    }
    expect(rendered.html).toContain("lax-account-lockup");
    expect(rendered.html).toContain('alt="LAX Account"');
  });

  it("sends the new address one link, as LAX Account, and says how long it works", async () => {
    const rendered = await renderEmail("staff-email-change-confirm", CONFIRM);
    expect(rendered.subject).toBe("Confirm your new email address");
    expect(rendered.html).toContain("https://account.lax.bid/account/email-change?t=signed.token");
    expect(rendered.html).toContain("lax-account-lockup");
    for (const body of [rendered.html, rendered.text]) {
      expect(body).toContain("ada.old@example.com");
      expect(body).toContain("7 days");
      expect(body).toContain("ignore this email");
    }
  });
});
