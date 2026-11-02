import { describe, expect, it } from "vitest";
import { renderEmail } from "./render.js";

const BASE = {
  userName: "Ada",
  whenDisplay: "23 October 2026 at 14:05 BST",
  deviceLabel: "Chrome on macOS",
  secureAccountUrl: "https://account.lax.bid/account/security",
} as const;

/** Every LAX Account security notice must say when, where from, and how to secure the account. */
function expectSharedParts(rendered: { html: string; text: string }) {
  for (const body of [rendered.html, rendered.text]) {
    expect(body).toContain("23 October 2026 at 14:05 BST");
    expect(body).toContain("Chrome on macOS");
    expect(body).toContain("If this wasn");
    expect(body).toContain("https://account.lax.bid/account/security");
    expect(body).toContain("Secure your account");
  }
  expect(rendered.html).toContain("lax-account-lockup");
  expect(rendered.html).toContain('alt="LAX Account"');
}

describe("LAX Account security emails", () => {
  it("renders two-step verification turned on", async () => {
    const rendered = await renderEmail("2fa-enabled", BASE);
    expect(rendered.subject).toBe("Two-step verification was turned on for your LAX Account");
    expect(rendered.text).toContain("Two-step verification was turned on");
    expectSharedParts(rendered);
  });

  it("renders two-step verification turned off", async () => {
    const rendered = await renderEmail("2fa-disabled", BASE);
    expect(rendered.subject).toBe("Two-step verification was turned off for your LAX Account");
    expect(rendered.text).toContain("protected by your password alone");
    expectSharedParts(rendered);
  });

  it("renders two-step verification reset by support and says every device was signed out", async () => {
    const rendered = await renderEmail("2fa-reset-by-support", BASE);
    expect(rendered.subject).toBe("Two-step verification was reset by LAX support");
    expect(rendered.text).toContain("LAX support reset two-step verification");
    expect(rendered.text).toContain("set up two-step verification again");
    expectSharedParts(rendered);
  });

  it("renders backup codes regenerated and says the old codes stop working", async () => {
    const rendered = await renderEmail("backup-codes-regenerated", BASE);
    expect(rendered.subject).toBe("New backup codes were created for your LAX Account");
    expect(rendered.text).toContain("Your old backup codes no longer work");
    expectSharedParts(rendered);
  });

  it("renders password changed", async () => {
    const rendered = await renderEmail("password-changed", BASE);
    expect(rendered.subject).toBe("Your LAX Account password was changed");
    expect(rendered.text).toContain("password for your LAX Account was changed");
    expectSharedParts(rendered);
  });

  it("renders the new-device sign-in notice with the 90 day window", async () => {
    const rendered = await renderEmail("new-device-login", BASE);
    expect(rendered.subject).toBe("New sign-in to your LAX Account");
    expect(rendered.text).toContain("last 90 days");
    expectSharedParts(rendered);
  });

  it("renders phone verified with the masked number", async () => {
    const rendered = await renderEmail("phone-verified", { ...BASE, maskedPhone: "+44 •••• 1234" });
    expect(rendered.subject).toBe("A phone number was verified on your LAX Account");
    expect(rendered.text).toContain("+44 •••• 1234");
    expectSharedParts(rendered);
  });

  it("renders email changed with both addresses, and different copy for each inbox", async () => {
    const vars = { ...BASE, previousEmail: "old@example.com", newEmail: "new@example.com" };
    const previous = await renderEmail("email-changed", { ...vars, recipient: "previous" });
    const next = await renderEmail("email-changed", { ...vars, recipient: "new" });
    expect(previous.subject).toBe("The email address on your LAX Account was changed");
    for (const rendered of [previous, next]) {
      expect(rendered.text).toContain("old@example.com");
      expect(rendered.text).toContain("new@example.com");
      expectSharedParts(rendered);
    }
    expect(previous.text).toContain("this address no longer signs in");
    expect(next.text).toContain("This address is now the email address");
  });

  it("leaves the device row out when the request had no user agent", async () => {
    const rendered = await renderEmail("2fa-enabled", { ...BASE, deviceLabel: null });
    expect(rendered.html).not.toContain("Device");
  });
});

describe("LAX Account deletion emails", () => {
  it("renders the request with the deletion date and how to cancel", async () => {
    const rendered = await renderEmail("account-deletion-requested", {
      ...BASE,
      effectiveDateDisplay: "22 November 2026",
      graceDays: 30,
      cancelDeletionUrl: "https://account.lax.bid/account/security/delete",
    });
    expect(rendered.subject).toBe("Your LAX Account is scheduled for deletion");
    for (const body of [rendered.html, rendered.text]) {
      expect(body).toContain("22 November 2026");
      expect(body).toContain("Cancel deletion");
      expect(body).toContain("https://account.lax.bid/account/security/delete");
      expect(body).toContain("Secure your account");
      expect(body).toContain("Chrome on macOS");
    }
  });

  it("renders the cancellation", async () => {
    const rendered = await renderEmail("account-deletion-cancelled", BASE);
    expect(rendered.subject).toBe("Deletion of your LAX Account was cancelled");
    expect(rendered.text).toContain("nothing will be erased");
    expectSharedParts(rendered);
  });
});
