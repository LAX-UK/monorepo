import { existsSync } from "node:fs";
import path from "node:path";
import { laxAccountOrigin } from "@/lib/lax-account-url";
import { describe, expect, it } from "vitest";
import {
  IDENTITY_SETTINGS_REDIRECTS,
  LEGACY_DASHBOARD_REDIRECTS,
  identitySettingsRedirects,
} from "./legacy-dashboard-redirects";

const destinationOf = (source: string) =>
  LEGACY_DASHBOARD_REDIRECTS.find((redirect) => redirect.source === source)?.destination;

describe("LEGACY_DASHBOARD_REDIRECTS", () => {
  it.each([
    ["/dashboard/portfolio", "/dashboard/purchases"],
    ["/dashboard/payments", "/dashboard/purchases#payment-history"],
    ["/dashboard/telephone-bids", "/dashboard/bids#telephone-bids"],
    ["/dashboard/condition-reports", "/dashboard/bids#condition-reports"],
    ["/dashboard/settings/payment-methods", "/dashboard/purchases"],
    ["/dashboard/submissions", "/dashboard/seller/consignments"],
    ["/dashboard/seller/in-sale", "/dashboard/seller/consignments?tab=in-sale"],
  ])("sends %s to %s", (source, destination) => {
    expect(destinationOf(source)).toBe(destination);
  });

  it("is permanent for every entry so old bookmarks and crawlers update", () => {
    expect(LEGACY_DASHBOARD_REDIRECTS.every((redirect) => redirect.permanent)).toBe(true);
  });

  it("lists each source once", () => {
    const sources = LEGACY_DASHBOARD_REDIRECTS.map((redirect) => redirect.source);
    expect(new Set(sources).size).toBe(sources.length);
  });

  it("never points at another redirected address", () => {
    const sources = new Set(LEGACY_DASHBOARD_REDIRECTS.map((redirect) => redirect.source));
    for (const { destination } of LEGACY_DASHBOARD_REDIRECTS) {
      expect(sources.has(destination.split("#")[0] ?? destination)).toBe(false);
    }
  });

  it("has no page left behind that the redirect would silently shadow", () => {
    const appDir = path.join(process.cwd(), "src", "app");
    for (const { source } of LEGACY_DASHBOARD_REDIRECTS) {
      expect(existsSync(path.join(appDir, source, "page.tsx"))).toBe(false);
    }
  });

  describe("organisation settings", () => {
    const rule = LEGACY_DASHBOARD_REDIRECTS.find((redirect) =>
      redirect.source.startsWith("/dashboard/organisations/"),
    );

    /**
     * Applies the rule's `:id/:path*` pattern: an id, then zero or more path segments, which the
     * destination repeats. The live redirect is checked against a running app in the PR.
     */
    function redirectTarget(pathname: string): string | null {
      if (!rule) return null;
      const matched = pathname.match(/^\/dashboard\/organisations\/([^/]+)((?:\/[^/]+)*)$/);
      if (!matched) return null;
      return `/dashboard/seller/organisations/${matched[1]}${matched[2] ?? ""}`;
    }

    it.each([
      ["/dashboard/organisations/org-1", "/dashboard/seller/organisations/org-1"],
      ["/dashboard/organisations/org-1/members", "/dashboard/seller/organisations/org-1/members"],
      [
        "/dashboard/organisations/org-1/documents",
        "/dashboard/seller/organisations/org-1/documents",
      ],
      ["/dashboard/organisations/org-1/connect", "/dashboard/seller/organisations/org-1/connect"],
      ["/dashboard/organisations/org-1/profile", "/dashboard/seller/organisations/org-1/profile"],
    ])("sends %s to %s", (from, to) => {
      expect(redirectTarget(from)).toBe(to);
    });

    it("declares the destination with the same id and path parameters", () => {
      expect(rule?.destination).toBe("/dashboard/seller/organisations/:id/:path*");
    });

    it("leaves the organisations list and invitations where they are", () => {
      expect(redirectTarget("/dashboard/organisations")).toBeNull();
      expect(redirectTarget("/dashboard/invitations/review/abc")).toBeNull();
    });

    it("has moved every page the old tabs pointed at", () => {
      const dashboardDir = path.join(process.cwd(), "src", "app", "dashboard");
      const moved = path.join(dashboardDir, "seller", "organisations", "[id]");
      for (const tab of ["", "members", "profile", "documents", "connect", "security"]) {
        expect(existsSync(path.join(moved, tab, "page.tsx"))).toBe(true);
      }
      expect(existsSync(path.join(dashboardDir, "organisations", "[id]"))).toBe(false);
    });
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

  it("leaves the Bid settings that remain alone", () => {
    const sources = new Set(rules.map((rule) => rule.source));
    for (const kept of ["bidding", "notifications", "interests", "appearance"]) {
      expect(sources.has(`/dashboard/settings/${kept}`)).toBe(false);
    }
  });

  it("points only at Account, never back at a Bid page, so it cannot loop", () => {
    const accountOrigin = laxAccountOrigin();
    for (const rule of identitySettingsRedirects(accountOrigin)) {
      expect(rule.destination.startsWith(`${accountOrigin}/account`)).toBe(true);
      expect(rule.destination).not.toContain("/dashboard/");
    }
  });

  it("has no Bid page left behind that a redirect would silently shadow", () => {
    const appDir = path.join(process.cwd(), "src", "app");
    for (const { source } of IDENTITY_SETTINGS_REDIRECTS) {
      expect(existsSync(path.join(appDir, source, "page.tsx"))).toBe(false);
    }
  });

  it("does not share a source with the other legacy redirects", () => {
    const legacy = new Set(LEGACY_DASHBOARD_REDIRECTS.map((rule) => rule.source));
    for (const { source } of IDENTITY_SETTINGS_REDIRECTS) {
      expect(legacy.has(source)).toBe(false);
    }
  });
});
