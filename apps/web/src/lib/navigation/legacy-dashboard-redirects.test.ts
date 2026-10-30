import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { laxAccountOrigin } from "@/lib/lax-account-url";
import { describe, expect, it } from "vitest";
import {
  IDENTITY_SETTINGS_REDIRECTS,
  LEGACY_DASHBOARD_REDIRECTS,
  identitySettingsRedirects,
  resolveLegacyDashboardRedirect,
} from "./legacy-dashboard-redirects";

const APP_DIR = path.join(process.cwd(), "src", "app");

/**
 * Whether the app serves a page (or route handler) at `pathname`, the way the router finds one:
 * route groups `(name)` add no segment and `[param]` folders match any one segment.
 */
function servesPage(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  function walk(dir: string, rest: readonly string[]): boolean {
    if (!existsSync(dir)) return false;
    const entries = readdirSync(dir).filter((entry) =>
      statSync(path.join(dir, entry)).isDirectory(),
    );
    if (rest.length === 0) {
      if (existsSync(path.join(dir, "page.tsx")) || existsSync(path.join(dir, "route.ts"))) {
        return true;
      }
      return entries.some((entry) => /^\(.+\)$/.test(entry) && walk(path.join(dir, entry), rest));
    }
    const [head, ...tail] = rest;
    return entries.some((entry) => {
      if (/^\(.+\)$/.test(entry)) return walk(path.join(dir, entry), rest);
      if (entry === head || /^\[[^.]+\]$/.test(entry)) return walk(path.join(dir, entry), tail);
      return false;
    });
  }
  return walk(APP_DIR, segments);
}

/** Every page the client area had under `/dashboard`, with sample ids, and where it lives now. */
const EVERY_OLD_PAGE: readonly [string, string][] = [
  ["/dashboard", "/home"],
  ["/dashboard/bids", "/bids"],
  ["/dashboard/telephone-bids/tb-1", "/bids/telephone/tb-1"],
  ["/dashboard/purchases", "/purchases"],
  ["/dashboard/checkout", "/purchases/checkout"],
  ["/dashboard/checkout/lot-1", "/purchases/checkout/lot-1"],
  ["/dashboard/watchlist", "/watching"],
  ["/dashboard/notifications", "/notifications"],
  ["/dashboard/settings", "/settings"],
  ["/dashboard/settings/bidding", "/settings/bidding"],
  ["/dashboard/settings/notifications", "/settings/notifications"],
  ["/dashboard/settings/interests", "/settings/interests"],
  ["/dashboard/settings/appearance", "/settings/appearance"],
  ["/dashboard/verify-identity", "/verify-identity"],
  ["/dashboard/compliance/source-of-funds", "/compliance/source-of-funds"],
  ["/dashboard/seller", "/selling/consignments"],
  ["/dashboard/seller/consignments", "/selling/consignments"],
  ["/dashboard/submissions/new", "/selling/new"],
  ["/dashboard/submissions/sub-1", "/selling/consignments/sub-1"],
  ["/dashboard/seller/works", "/collection"],
  ["/dashboard/seller/payouts", "/selling/payouts"],
  ["/dashboard/seller/connect", "/selling/payout-setup"],
  ["/dashboard/seller/artist", "/selling/artist"],
  ["/dashboard/seller/organisations/org-1", "/organisation?account=org-1"],
  ["/dashboard/seller/organisations/org-1/profile", "/organisation?account=org-1"],
  ["/dashboard/seller/organisations/org-1/members", "/team?account=org-1"],
  ["/dashboard/seller/organisations/org-1/documents", "/organisation/documents?account=org-1"],
  ["/dashboard/seller/organisations/org-1/connect", "/organisation/payouts?account=org-1"],
  ["/dashboard/seller/organisations/org-1/security", "/organisation/security?account=org-1"],
  ["/dashboard/organisations", "/organisations"],
  ["/dashboard/invitations", "/organisations/invitations"],
  ["/dashboard/invitations/accept/tok-1", "/organisations/invitations/accept/tok-1"],
  ["/dashboard/invitations/review/inv-1", "/organisations/invitations/review/inv-1"],
  [
    "/dashboard/legal-entities/le-1/payouts/po-1/statement",
    "/legal-entities/le-1/payouts/po-1/statement",
  ],
];

/** Addresses that already redirected before the move; they now go straight to the new page. */
const EARLIER_RETIREMENTS: readonly [string, string][] = [
  ["/dashboard/portfolio", "/purchases"],
  ["/dashboard/payments", "/purchases#payment-history"],
  ["/dashboard/telephone-bids", "/bids#telephone-bids"],
  ["/dashboard/condition-reports", "/bids#condition-reports"],
  ["/dashboard/settings/payment-methods", "/purchases"],
  ["/dashboard/submissions", "/selling/consignments"],
  ["/dashboard/seller/in-sale", "/selling/consignments?tab=in-sale"],
  ["/dashboard/artist-follow", "/watching?section=artists"],
  ["/dashboard/organisations/org-1", "/organisation?account=org-1"],
  ["/dashboard/organisations/org-1/members", "/team?account=org-1"],
  ["/dashboard/organisations/org-1/connect", "/organisation/payouts?account=org-1"],
];

describe("retired client pages", () => {
  it("opens Selling on Consignments, keeping the query string", () => {
    expect(resolveLegacyDashboardRedirect("/selling")).toBe("/selling/consignments");
    expect(resolveLegacyDashboardRedirect("/selling/", "?tab=unsold")).toBe(
      "/selling/consignments?tab=unsold",
    );
    expect(servesPage("/selling")).toBe(false);
    expect(servesPage("/selling/consignments")).toBe(true);
  });

  it("sends Members to Team and Works to Collection, keeping the query string", () => {
    expect(resolveLegacyDashboardRedirect("/organisation/members", "?account=org-1")).toBe(
      "/team?account=org-1",
    );
    expect(resolveLegacyDashboardRedirect("/selling/works")).toBe("/collection");
    expect(servesPage("/organisation/members")).toBe(false);
    expect(servesPage("/team")).toBe(true);
    expect(servesPage("/collection")).toBe(true);
  });

  it("leaves every page under Selling where it is", () => {
    for (const path of ["/selling/new", "/selling/consignments", "/selling/payouts"]) {
      expect(resolveLegacyDashboardRedirect(path)).toBeNull();
    }
  });
});

describe("LEGACY_DASHBOARD_REDIRECTS", () => {
  it.each([...EVERY_OLD_PAGE, ...EARLIER_RETIREMENTS])("sends %s to %s", (from, to) => {
    expect(resolveLegacyDashboardRedirect(from)).toBe(to);
  });

  it.each(EVERY_OLD_PAGE)("serves a page where %s now goes", (_from, to) => {
    const pathname = to.split(/[?#]/)[0] ?? to;
    expect(servesPage(pathname)).toBe(true);
  });

  it("keeps the query string, alongside any the destination adds", () => {
    expect(resolveLegacyDashboardRedirect("/dashboard/purchases", "?payment=due")).toBe(
      "/purchases?payment=due",
    );
    expect(
      resolveLegacyDashboardRedirect("/dashboard/seller/organisations/org-1/members", "?welcome=1"),
    ).toBe("/team?account=org-1&welcome=1");
    expect(resolveLegacyDashboardRedirect("/dashboard/payments", "?a=1&b=2")).toBe(
      "/purchases?a=1&b=2#payment-history",
    );
    expect(resolveLegacyDashboardRedirect("/dashboard", "?welcome=back&utm_source=a")).toBe(
      "/home?welcome=back&utm_source=a",
    );
  });

  it("ignores a trailing slash", () => {
    expect(resolveLegacyDashboardRedirect("/dashboard/bids/")).toBe("/bids");
  });

  it("leaves addresses outside the old client area alone", () => {
    expect(resolveLegacyDashboardRedirect("/bids")).toBeNull();
    expect(resolveLegacyDashboardRedirect("/admin/dashboard")).toBeNull();
    expect(resolveLegacyDashboardRedirect("/dashboard/unknown")).toBeNull();
  });

  it("is permanent (308) for every entry so old bookmarks and crawlers update", () => {
    expect(LEGACY_DASHBOARD_REDIRECTS.every((redirect) => redirect.permanent)).toBe(true);
  });

  it("lists each source once", () => {
    const sources = LEGACY_DASHBOARD_REDIRECTS.map((redirect) => redirect.source);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it("never points at another redirected address, so nobody follows a chain", () => {
    for (const { destination } of LEGACY_DASHBOARD_REDIRECTS) {
      const pathname = destination.split(/[?#]/)[0] ?? destination;
      expect(resolveLegacyDashboardRedirect(pathname)).toBeNull();
    }
  });

  it("has no page left under /dashboard that a redirect would shadow", () => {
    expect(existsSync(path.join(APP_DIR, "dashboard"))).toBe(false);
  });
});

describe("identity settings redirects", () => {
  const origin = "https://account.example.test";
  const rules = identitySettingsRedirects(origin);
  const destination = (source: string) => rules.find((rule) => rule.source === source)?.destination;

  it.each([
    ["/dashboard/settings/profile", "/account/profile"],
    ["/dashboard/settings/account", "/account/profile"],
    ["/dashboard/settings/account/confirm", "/account/email-change"],
    ["/dashboard/settings/addresses", "/account/profile"],
    ["/dashboard/settings/security", "/account/security"],
    ["/dashboard/settings/security/two-factor", "/account/security"],
    ["/dashboard/settings/sessions", "/account/security"],
  ])("sends %s to %s on the Account origin", (source, accountPath) => {
    expect(destination(source)).toBe(`${origin}${accountPath}`);
  });

  it("is permanent (308) for every retired page", () => {
    expect(rules).toHaveLength(IDENTITY_SETTINGS_REDIRECTS.length);
    expect(rules.every((rule) => rule.permanent)).toBe(true);
  });

  it("ignores a trailing slash on the origin", () => {
    expect(identitySettingsRedirects(`${origin}/`)[0]?.destination).toBe(
      `${origin}/account/profile`,
    );
  });

  it("points only at Account, never back at a Bid page, so it cannot loop", () => {
    const accountOrigin = laxAccountOrigin();
    for (const rule of identitySettingsRedirects(accountOrigin)) {
      expect(rule.destination.startsWith(`${accountOrigin}/account`)).toBe(true);
      expect(rule.destination).not.toContain("/dashboard/");
    }
  });

  it("does not share a source with the client area map", () => {
    for (const { source } of IDENTITY_SETTINGS_REDIRECTS) {
      expect(resolveLegacyDashboardRedirect(source)).toBeNull();
    }
  });
});
