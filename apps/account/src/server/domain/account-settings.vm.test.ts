import { describe, expect, it } from "vitest";
import { buildAccountLinks } from "./account-links";
import { buildPrivacyGroups } from "./account-privacy.vm";
import {
  accountInitials,
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

describe("buildSecurityGroups", () => {
  it("offers deleting the account as an Account page, not a link into another product", () => {
    const groups = buildSecurityGroups({ twoStep: "on", backupCodesRemaining: null }, withBid);
    expect(groups.map((group) => group.id)).toEqual(["sign-in", "your-account"]);
    expect(groups[1]?.rows).toEqual([
      {
        title: "Delete your account",
        subtitle: "Permanently delete your LAX account",
        href: "/account/security/delete",
      },
    ]);
  });

  it("opens the hosted password and two-step pages", () => {
    const [group] = buildSecurityGroups(
      { twoStep: "unknown", backupCodesRemaining: null },
      withBid,
    );
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

  const subtitle = (twoStep: "on" | "off" | "unknown", backupCodesRemaining: number | null) =>
    buildSecurityGroups({ twoStep, backupCodesRemaining }, withBid)[0]?.rows[1]?.subtitle;

  it("states On, Off or the neutral wording for each two-step state", () => {
    expect(subtitle("on", 8)).toBe("On");
    expect(subtitle("on", null)).toBe("On");
    expect(subtitle("off", null)).toBe("Off. Turn it on");
    expect(subtitle("unknown", null)).toBe("Set up or manage");
  });

  it("mentions backup codes only when few are left", () => {
    expect(subtitle("on", 3)).toBe("On. 3 backup codes left");
    expect(subtitle("on", 1)).toBe("On. 1 backup code left");
    expect(subtitle("on", 0)).toBe("On. 0 backup codes left");
    expect(subtitle("on", 4)).toBe("On");
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
      payoutLinks: [{ label: "lax.art payouts", href: "https://lax.art/account/payouts" }],
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

describe("buildPrivacyGroups", () => {
  it("links notifications and policies to Bid, and deletion to Account", () => {
    const groups = buildPrivacyGroups(withBid);
    expect(groups.map((g) => g.rows.map((r) => r.title))).toEqual([
      ["Notification preferences"],
      ["Delete your account"],
      ["Privacy policy", "Terms of use"],
    ]);
    expect(groups[0]?.rows[0]?.href).toBe("https://test.lax.bid/settings/notifications");
    expect(groups[1]?.rows[0]?.href).toBe("/account/security/delete");
  });

  it("still offers deletion without Bid, since Account owns it", () => {
    const groups = buildPrivacyGroups(withoutBid);
    expect(groups.map((g) => g.id)).toEqual(["your-data"]);
    expect(groups[0]?.rows[0]?.href).toBe("/account/security/delete");
  });

  it("tells people what deletion checks and that they can cancel", () => {
    const footer = buildPrivacyGroups(withoutBid)[0]?.footer ?? "";
    expect(footer).toMatch(/LAX Bid, LAX Shop and lax\.art/);
    expect(footer).toMatch(/cancel for 30 days/);
  });
});
