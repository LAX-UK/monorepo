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
});
