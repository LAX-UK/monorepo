import { describe, expect, it } from "vitest";
import type { ProfileContactVm } from "./account-contact.vm";
import { buildAccountLinks } from "./account-links";
import { buildProfileSections, maskPendingEmail } from "./account-profile.vm";

const withBid = buildAccountLinks({
  oidcIssuer: "https://test-auth.lax.bid",
  oidcClientId: "lax-account-web",
  bidPublicUrl: "https://test.lax.bid",
});
const withoutBid = buildAccountLinks({
  oidcIssuer: "https://test-auth.lax.bid",
  oidcClientId: "lax-account-web",
});

const contact: ProfileContactVm = {
  email: "shima@example.com",
  emailVerified: true,
  pendingEmail: null,
  phone: "+201234567890",
  phoneVerified: false,
};

describe("buildProfileSections", () => {
  it("masks the email, shows the phone in full and explains how each changes", () => {
    const sections = buildProfileSections(contact, withBid);
    expect(sections.map((s) => s.id)).toEqual(["email", "phone", "addresses"]);
    expect(sections[0]?.fields[0]).toEqual({
      label: "Email address",
      value: "s***@example.com",
      status: { label: "Verified", tone: "success" },
    });
    expect(sections[0]?.note).toMatch(/current and your new address/);
    expect(sections[1]?.fields[0]).toEqual({
      label: "Phone number",
      value: "+201234567890",
      status: { label: "Not verified", tone: "neutral" },
    });
    expect(sections[1]?.note).toMatch(/can't sign in with it/);
    expect(sections[2]?.actions[0]?.href).toBe("https://test.lax.bid/dashboard/settings/addresses");
  });

  it("no longer sends people to support to change their email or phone", () => {
    const sections = buildProfileSections(contact, withBid);
    expect(JSON.stringify(sections.slice(0, 2))).not.toMatch(/Contact us|yet/);
  });

  it("offers the hosted verify step for an unverified email", () => {
    const [email] = buildProfileSections({ ...contact, emailVerified: false }, withBid);
    expect(email?.actions).toEqual([
      { label: "Verify email", href: expect.stringContaining("/resend-verification") },
    ]);
  });

  it("shows missing values without a status and hides Bid-only parts without Bid", () => {
    const sections = buildProfileSections(
      { email: null, emailVerified: false, pendingEmail: null, phone: null, phoneVerified: false },
      withoutBid,
    );
    expect(sections.map((s) => s.id)).toEqual(["email", "phone"]);
    expect(sections.flatMap((s) => s.actions)).toEqual([]);
    expect(sections[1]?.fields[0]).toEqual({ label: "Phone number", value: null });
  });
});

describe("maskPendingEmail", () => {
  it("masks the address a change is waiting on", () => {
    expect(maskPendingEmail({ ...contact, pendingEmail: "new.address@example.com" })).toBe(
      "n***@example.com",
    );
  });

  it("is null when no change is in progress", () => {
    expect(maskPendingEmail(contact)).toBeNull();
  });
});
