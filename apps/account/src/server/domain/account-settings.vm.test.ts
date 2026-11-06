import { describe, expect, it } from "vitest";
import { buildAccountLinks } from "./account-links";
import { buildPrivacyGroups } from "./account-privacy.vm";
import {
  ACCOUNT_ROUTES,
  accountInitials,
  buildHelpGroups,
  buildLaunchGroups,
  buildTwoStepRow,
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

describe("buildTwoStepRow", () => {
  it("opens the hosted two-step page", () => {
    const row = buildTwoStepRow({ twoStep: "unknown", backupCodesRemaining: null }, withBid);
    expect([row.title, row.subtitle, row.href]).toEqual([
      "Two-step verification",
      "Set up or manage",
      "https://test-auth.lax.bid/two-factor/manage?client_id=lax-account-web",
    ]);
  });

  it("points Security's one quiet delete link at the Privacy section that holds it", () => {
    expect(ACCOUNT_ROUTES.deleteAccountOnPrivacy).toBe("/account/privacy#group-your-data");
    const rows = buildPrivacyGroups(withBid).flatMap((group) => group.rows);
    expect(rows.map((row) => row.title)).toContain("Delete your account");
  });

  const subtitle = (twoStep: "on" | "off" | "unknown", backupCodesRemaining: number | null) =>
    buildTwoStepRow({ twoStep, backupCodesRemaining }, withBid).subtitle;

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
  it("links alerts, downloading and deleting to Account, and policies to Bid", () => {
    const groups = buildPrivacyGroups(withBid);
    expect(groups.map((g) => g.rows.map((r) => r.title))).toEqual([
      ["Email alerts"],
      ["Download your data", "Delete your account"],
      ["Privacy policy", "Terms of use"],
    ]);
    expect(groups[0]?.rows[0]?.href).toBe("/account/alerts");
    expect(groups[1]?.rows.map((r) => r.href)).toEqual([
      "/account/privacy/download",
      "/account/security/delete",
    ]);
  });

  it("puts the download row first and gives it the state's line", () => {
    const [row] = buildPrivacyGroups(withBid, "Ready until 9 Nov")[1]?.rows ?? [];
    expect(row).toEqual({
      title: "Download your data",
      subtitle: "Ready until 9 Nov",
      href: "/account/privacy/download",
    });
    expect(buildPrivacyGroups(withBid)[1]?.rows[0]?.subtitle).toBe(
      "A copy of the information LAX holds about you",
    );
  });

  it("still offers alerts, downloading and deleting without Bid, since Account owns them", () => {
    const groups = buildPrivacyGroups(withoutBid);
    expect(groups.map((g) => g.id)).toEqual(["notifications", "your-data"]);
    expect(groups[1]?.rows.map((r) => r.href)).toEqual([
      "/account/privacy/download",
      "/account/security/delete",
    ]);
  });

  it("tells people what deletion checks and that they can cancel", () => {
    const footer = buildPrivacyGroups(withoutBid)[1]?.footer ?? "";
    expect(footer).toMatch(/LAX Bid, LAX Shop and lax\.art/);
    expect(footer).toMatch(/cancel for 30 days/);
  });
});
