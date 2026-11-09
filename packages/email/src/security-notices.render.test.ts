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

  it("renders phone removed with the masked number", async () => {
    const rendered = await renderEmail("phone-removed", { ...BASE, maskedPhone: "+44 •••• 1234" });
    expect(rendered.subject).toBe("The phone number on your LAX Account was removed");
    expect(rendered.text).toContain("+44 •••• 1234");
    expectSharedParts(rendered);
  });

  it("renders a removed sign-in method with the method and says other devices were signed out", async () => {
    const rendered = await renderEmail("sign-in-method-removed", {
      ...BASE,
      methodLabel: "Google",
      detail: "ada@example.com",
    });
    expect(rendered.subject).toBe("A way to sign in was removed from your LAX Account");
    expect(rendered.text).toContain("Google (ada@example.com) was removed");
    expect(rendered.text).toContain("signed out");
    expectSharedParts(rendered);
  });

  describe("emails queued before the change still render", () => {
    it("renders a legacy sign-in-method-removed payload (providerName, no methodLabel)", async () => {
      const rendered = await renderEmail("sign-in-method-removed", {
        ...BASE,
        providerName: "Apple",
      } as never);
      expect(rendered.subject).toBe("A way to sign in was removed from your LAX Account");
      expect(rendered.text).toContain("Apple was removed");
      expect(rendered.text).not.toContain("undefined");
      expectSharedParts(rendered);
    });

    it("renders a sign-in-method-removed payload with neither a label nor a provider", async () => {
      const rendered = await renderEmail("sign-in-method-removed", { ...BASE } as never);
      expect(rendered.text).toContain("A sign-in method was removed");
    });

    it("renders a queued social-account-linked as the added email", async () => {
      const rendered = await renderEmail("social-account-linked", {
        provider: "google",
        userName: "Ada",
      });
      expect(rendered.subject).toBe("A way to sign in was added to your LAX Account");
      expect(rendered.text).toContain("Hi Ada");
      expect(rendered.text).toContain("Google was added");
      expect(rendered.text).not.toContain("undefined");
    });

    it("renders a queued social-account-unlinked as the removed email", async () => {
      const rendered = await renderEmail("social-account-unlinked", {
        provider: "apple",
        userName: null,
      });
      expect(rendered.subject).toBe("A way to sign in was removed from your LAX Account");
      expect(rendered.text).toContain("Hi there");
      expect(rendered.text).toContain("Apple was removed");
      expect(rendered.text).not.toContain("undefined");
    });

    it("says where to look when a queued email has no link, instead of showing an empty button", async () => {
      const rendered = await renderEmail("social-account-linked", { provider: "apple" });
      expect(rendered.text).toContain("open Security");
      expect(rendered.html).not.toContain('href=""');
    });
  });

  it("renders a removed passkey by its name", async () => {
    const rendered = await renderEmail("sign-in-method-removed", {
      ...BASE,
      methodLabel: "A passkey",
      detail: "Sarah's MacBook",
    });
    expect(rendered.text).toContain("A passkey (Sarah's MacBook) was removed");
    expectSharedParts(rendered);
  });

  it("renders an added sign-in method naming the method, the address or name, and when", async () => {
    const rendered = await renderEmail("sign-in-method-added", {
      ...BASE,
      methodLabel: "Apple",
      detail: "relay@privaterelay.appleid.com",
    });
    expect(rendered.subject).toBe("A way to sign in was added to your LAX Account");
    expect(rendered.text).toContain("Apple (relay@privaterelay.appleid.com) was added");
    expectSharedParts(rendered);
    const bare = await renderEmail("sign-in-method-added", { ...BASE, methodLabel: "A passkey" });
    expect(bare.text).toContain("A passkey was added");
  });

  it("renders the removed unconfirmed password: what happened, that devices were signed out, and the way back", async () => {
    const rendered = await renderEmail("unconfirmed-password-removed", {
      ...BASE,
      providerName: "Google",
    });
    expect(rendered.subject).toBe("We secured your LAX Account");
    expect(rendered.text).toContain("You signed in with Google and confirmed your email");
    expect(rendered.text).toContain("set on this account without the email being confirmed");
    expect(rendered.text).toContain("signed out every other device");
    expect(rendered.text).toContain("Set a new password in Security");
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

describe("LAX Account data download emails", () => {
  it("renders the request notice with when and where it came from", async () => {
    const rendered = await renderEmail("data-export-requested", BASE);
    expect(rendered.subject).toBe("A copy of your data was requested");
    expect(rendered.text).toContain("A copy of the data LAX holds about you was requested");
    expectSharedParts(rendered);
  });

  it("renders the ready notice with a link to LAX Account and no file link", async () => {
    const rendered = await renderEmail("data-export-ready", {
      userName: "Ada",
      dataExportUrl: "https://account.lax.bid/account/privacy/download",
      expiresDisplay: "30 October 2026",
      retentionDays: 7,
    });
    expect(rendered.subject).toBe("Your data is ready");
    expect(rendered.text).toContain("7 days");
    for (const body of [rendered.html, rendered.text]) {
      expect(body).toContain("https://account.lax.bid/account/privacy/download");
      expect(body).toContain("30 October 2026");
      expect(body).not.toMatch(/\.zip/);
    }
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

  it("renders the reminder a week before the deletion, with a cancel link", async () => {
    const rendered = await renderEmail("account-deletion-reminder", {
      userName: "Ada",
      effectiveDateDisplay: "2 December 2026",
      daysLeft: 7,
      cancelDeletionUrl: "https://account.lax.bid/account/security/delete",
    });
    expect(rendered.subject).toBe("Your LAX Account will be deleted next week");
    for (const body of [rendered.html, rendered.text]) {
      expect(body).toContain("2 December 2026");
      expect(body).toContain("https://account.lax.bid/account/security/delete");
    }
    expect(rendered.text).toContain("In 7 days");
    expect(rendered.html).toContain('alt="LAX Account"');
  });

  it("renders the hold with every reason and the date it will be checked again", async () => {
    const rendered = await renderEmail("account-deletion-held", {
      userName: "Ada",
      title: "Your account deletion is on hold",
      basis: "We can't delete your account yet.",
      reasonsIntro: "What is still open:",
      reasons: ["You have an unpaid invoice.", "A payout to you has not been paid yet."],
      recheck: "We'll check again on 4 December.",
      resolution: "Once these are settled we'll delete your account automatically.",
      cancelDeletionUrl: "https://account.lax.bid/account/security/delete",
    });
    expect(rendered.subject).toBe("Your LAX Account deletion is on hold");
    for (const body of [rendered.html, rendered.text]) {
      expect(body).toContain("You have an unpaid invoice.");
      expect(body).toContain("A payout to you has not been paid yet.");
    }
    expect(rendered.text).toContain("We'll check again on 4 December.");
  });

  it("renders the completion notice without any personal detail", async () => {
    const rendered = await renderEmail("account-deletion-completed", {
      erasedOnDisplay: "2 December 2026",
    });
    expect(rendered.subject).toBe("Your LAX Account was deleted");
    expect(rendered.text).toContain("we deleted your LAX Account on 2 December 2026");
    expect(rendered.text).not.toMatch(/Hi /);
  });
});
