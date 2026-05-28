import { buildClientBreadcrumbTrail } from "@/lib/navigation/client-breadcrumb-trail";
import { describe, expect, it } from "vitest";

describe("buildClientBreadcrumbTrail", () => {
  it("returns single item on dashboard root", () => {
    expect(buildClientBreadcrumbTrail("/dashboard")).toEqual([{ label: "Dashboard" }]);
  });

  it("labels payments from nav", () => {
    expect(buildClientBreadcrumbTrail("/dashboard/payments")).toEqual([
      { label: "Dashboard", href: "/dashboard" },
      { label: "My payments" },
    ]);
  });

  it("labels verify-identity", () => {
    expect(buildClientBreadcrumbTrail("/dashboard/verify-identity")).toEqual([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Verify identity" },
    ]);
  });

  it("labels organisation detail without raw uuid", () => {
    const trail = buildClientBreadcrumbTrail("/dashboard/organisations/org-uuid-123");
    expect(trail.map((i) => i.label)).toEqual(["Dashboard", "Organisations", "Organisation"]);
    expect(trail[1]?.href).toBe("/dashboard/organisations");
  });

  it("labels checkout lot without raw id", () => {
    const trail = buildClientBreadcrumbTrail("/dashboard/checkout/lot-abc");
    expect(trail.map((i) => i.label)).toEqual(["Dashboard", "Collection", "Checkout"]);
  });

  it("title-cases settings leaf segments", () => {
    expect(buildClientBreadcrumbTrail("/dashboard/settings/security/two-factor")).toEqual([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Settings", href: "/dashboard/settings" },
      { label: "Two-factor authentication" },
    ]);
  });

  it("labels seller connect and payouts", () => {
    expect(
      buildClientBreadcrumbTrail("/dashboard/seller/connect", "selling").map((i) => i.label),
    ).toEqual(["Dashboard", "Selling", "Payout setup"]);
    expect(
      buildClientBreadcrumbTrail("/dashboard/seller/payouts", "selling").map((i) => i.label),
    ).toEqual(["Dashboard", "Selling", "Sold & payouts"]);
  });

  it("labels artist-follow route", () => {
    expect(buildClientBreadcrumbTrail("/dashboard/artist-follow")).toEqual([
      { label: "Dashboard", href: "/dashboard" },
      { label: "Followed artists" },
    ]);
  });
});
