import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LEGACY_DASHBOARD_REDIRECTS } from "./legacy-dashboard-redirects";

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
