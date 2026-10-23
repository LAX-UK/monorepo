import { describe, expect, it } from "vitest";
import { buildAccountLinks } from "./account-links";
import { buildPrivacyGroups } from "./account-privacy.vm";
import { buildProfileSections } from "./account-profile.vm";
import {
  accountInitials,
  buildAccountSections,
  buildHelpGroups,
  buildLaunchGroups,
  buildSecurityGroups,
} from "./account-settings.vm";

const withBid = buildAccountLinks({
  oidcIssuer: "https://test-auth.lax.bid",
  oidcClientId: "lax-account-web",
  bidPublicUrl: "https://test.lax.bid",
});
const withoutBid = buildAccountLinks({
  oidcIssuer: "https://test-auth.lax.bid",
  oidcClientId: "lax-account-web",
});

const overview = {
  name: "Shima Mohamed",
  email: "shima@example.com",
  emailVerified: true,
  phone: "+201234567890",
  phoneVerified: false,
  signedInWithAuthenticator: false,
};

describe("buildAccountSections", () => {
  it("lists the four categories with the Help card", () => {
    const sections = buildAccountSections(withBid);
    expect(sections.map((s) => [s.title, s.href])).toEqual([
      ["Personal details", "/account/profile"],
      ["Password and security", "/account/security"],
      ["Notifications and privacy", "/account/privacy"],
      ["Help", "/account/help"],
    ]);
  });

  it("leaves Help out when Bid, which publishes the help pages, is not configured", () => {
    expect(buildAccountSections(withoutBid).map((s) => s.id)).toEqual([
      "personal-details",
      "security",
      "privacy",
    ]);
  });
});

describe("buildSecurityGroups", () => {
  it("opens the hosted password and two-step pages", () => {
    const [group] = buildSecurityGroups({ twoStepConfirmed: false }, withBid);
    expect(group?.rows.map((r) => [r.title, r.subtitle, r.href])).toEqual([
      [
        "Password",
        "We'll email you a secure link to change it",
        "https://test-auth.lax.bid/forgot-password?client_id=lax-account-web",
      ],
      [
        "Two-step verification",
        "Set up or manage",
        "https://test-auth.lax.bid/two-factor/manage?client_id=lax-account-web",
      ],
    ]);
  });

  it("states two-step is on only when this sign-in used it", () => {
    const [group] = buildSecurityGroups({ twoStepConfirmed: true }, withBid);
    expect(group?.rows[1]?.subtitle).toBe("On");
  });
});

describe("buildHelpGroups", () => {
  it("links the help centre and contact page, and is empty without Bid", () => {
    expect(buildHelpGroups(withBid)[0]?.rows.map((r) => r.title)).toEqual([
      "Help centre",
      "Contact us",
    ]);
    expect(buildHelpGroups(withoutBid)).toEqual([]);
  });
});

describe("buildLaunchGroups", () => {
  it("adds payout and staff launch groups only when they have rows", () => {
    expect(buildLaunchGroups({ payoutLinks: [], staffPlatforms: [] })).toEqual([]);
    const groups = buildLaunchGroups({
      payoutLinks: [{ label: "LAX Art payouts", href: "https://lax.art/account/payouts" }],
      staffPlatforms: [{ product: "bid", label: "LAX Bid admin", href: "https://lax.bid/admin" }],
    });
    expect(groups.map((g) => g.id)).toEqual(["payouts", "lax-access"]);
    expect(groups[1]?.rows[0]).toEqual({
      title: "LAX Bid admin",
      subtitle: "Staff access",
      href: "https://lax.bid/admin",
    });
  });
});

describe("accountInitials", () => {
  it("uses the first and last name initials", () => {
    expect(accountInitials({ name: "shima ali mohamed", email: null })).toBe("SM");
    expect(accountInitials({ name: "Cher", email: null })).toBe("C");
  });

  it("falls back to the email, then to nothing", () => {
    expect(accountInitials({ name: null, email: "ada@example.com" })).toBe("A");
    expect(accountInitials({ name: null, email: null })).toBeNull();
  });
});

describe("buildProfileSections", () => {
  it("masks the email and sends every update to the Bid screen that owns it", () => {
    const sections = buildProfileSections(overview, withBid);
    expect(sections.map((s) => s.id)).toEqual(["about", "email", "phone", "addresses"]);
    const email = sections[1];
    expect(email?.fields[0]).toEqual({
      label: "Email address",
      value: "s***@example.com",
      status: { label: "Verified", tone: "success" },
    });
    expect(email?.actions).toEqual([
      { label: "Update", href: "https://test.lax.bid/dashboard/settings/account" },
    ]);
    expect(sections[2]?.fields[0]?.status).toEqual({ label: "Not verified", tone: "neutral" });
    expect(sections[3]?.actions[0]?.href).toBe("https://test.lax.bid/dashboard/settings/addresses");
  });

  it("offers the hosted verify step for an unverified email", () => {
    const [, email] = buildProfileSections({ ...overview, emailVerified: false }, withBid);
    expect(email?.actions.map((a) => a.label)).toEqual(["Verify email", "Update"]);
  });

  it("shows missing values without a status and hides Bid-only parts without Bid", () => {
    const sections = buildProfileSections(
      { name: null, email: null, emailVerified: false, phone: null, phoneVerified: false },
      withoutBid,
    );
    expect(sections.map((s) => s.id)).toEqual(["about", "email", "phone"]);
    expect(sections.flatMap((s) => s.actions)).toEqual([]);
    expect(sections[2]?.fields[0]).toEqual({ label: "Phone number", value: null });
  });
});

describe("buildPrivacyGroups", () => {
  it("links notifications, deletion and policies to Bid", () => {
    const groups = buildPrivacyGroups(withBid);
    expect(groups.map((g) => g.rows.map((r) => r.title))).toEqual([
      ["Notification preferences"],
      ["Delete your account"],
      ["Privacy policy", "Terms of use"],
    ]);
    expect(groups[0]?.rows[0]?.href).toBe("https://test.lax.bid/dashboard/settings/notifications");
    expect(groups[1]?.rows[0]?.href).toBe("https://test.lax.bid/dashboard/settings/security");
  });

  it("is empty without Bid", () => {
    expect(buildPrivacyGroups(withoutBid)).toEqual([]);
  });
});
