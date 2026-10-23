import { buildClientBreadcrumbTrail } from "@/lib/navigation/client-breadcrumb-trail";
import { describe, expect, it } from "vitest";

describe("buildClientBreadcrumbTrail", () => {
  it("labels purchases from nav", () => {
    expect(buildClientBreadcrumbTrail("/dashboard/purchases")).toEqual([{ label: "Purchases" }]);
  });

  it("labels organisation detail without raw uuid", () => {
    const trail = buildClientBreadcrumbTrail("/dashboard/seller/organisations/org-uuid-123");
    expect(trail.map((i) => i.label)).toEqual(["Selling", "Organisation"]);
    expect(trail[0]?.href).toBe("/dashboard/seller");
  });

  it("labels organisation tab routes without Detail fallback", () => {
    expect(
      buildClientBreadcrumbTrail("/dashboard/seller/organisations/org-uuid-123/members").map(
        (i) => i.label,
      ),
    ).toEqual(["Selling", "Organisation", "Members"]);
    expect(
      buildClientBreadcrumbTrail("/dashboard/seller/organisations/org-uuid-123/connect").map(
        (i) => i.label,
      ),
    ).toEqual(["Selling", "Organisation", "Payout setup"]);
    expect(
      buildClientBreadcrumbTrail("/dashboard/seller/organisations/org-uuid-123/security").map(
        (i) => i.label,
      ),
    ).toEqual(["Selling", "Organisation", "Two-step policy"]);
  });

  it("labels invitation review and accept without Detail fallback", () => {
    expect(
      buildClientBreadcrumbTrail("/dashboard/invitations/review/inv-123").map((i) => i.label),
    ).toEqual(["Invitations", "Review invitation"]);
    expect(
      buildClientBreadcrumbTrail("/dashboard/invitations/accept/token-abc").map((i) => i.label),
    ).toEqual(["Invitations", "Accept invitation"]);
  });

  it("labels legal entity payout statement", () => {
    expect(
      buildClientBreadcrumbTrail(
        "/dashboard/legal-entities/le-1/payouts/po-1/statement",
        "selling",
      ).map((i) => i.label),
    ).toEqual(["Selling", "Sold & payouts", "Statement"]);
    expect(
      buildClientBreadcrumbTrail(
        "/dashboard/legal-entities/le-1/payouts/po-1/statement",
        "buying",
      ).map((i) => i.label),
    ).toEqual(["Sold & payouts", "Statement"]);
  });

  it("labels checkout lot without raw id", () => {
    const trail = buildClientBreadcrumbTrail("/dashboard/checkout/lot-abc");
    expect(trail.map((i) => i.label)).toEqual(["Purchases", "Checkout"]);
  });

  it("labels new submission route", () => {
    expect(buildClientBreadcrumbTrail("/dashboard/submissions/new")).toEqual([
      { label: "New submission" },
    ]);
  });

  it("labels the remaining Bid settings pages", () => {
    expect(buildClientBreadcrumbTrail("/dashboard/settings/bidding")).toEqual([
      { label: "Bid settings", href: "/dashboard/settings" },
      { label: "Bidding limits" },
    ]);
    expect(buildClientBreadcrumbTrail("/dashboard/settings/notifications")).toEqual([
      { label: "Bid settings", href: "/dashboard/settings" },
      { label: "Auction alerts and notifications" },
    ]);
  });

  it("never falls through to Detail on covered nested routes", () => {
    const paths = [
      "/dashboard/seller/organisations/org-1/documents",
      "/dashboard/seller/consignments",
      "/dashboard/seller/works",
      "/dashboard/invitations/review/x",
      "/dashboard/legal-entities/le/payouts/p/st/statement",
      "/dashboard/settings/appearance",
    ];
    for (const path of paths) {
      const labels = buildClientBreadcrumbTrail(path).map((i) => i.label);
      expect(labels).not.toContain("Detail");
    }
  });

  it("labels the merged consignments and works pages", () => {
    expect(
      buildClientBreadcrumbTrail("/dashboard/seller/consignments", "selling").map((i) => i.label),
    ).toEqual(["Selling", "Consignments"]);
    expect(
      buildClientBreadcrumbTrail("/dashboard/seller/works", "selling").map((i) => i.label),
    ).toEqual(["Selling", "Works"]);
  });

  it("labels seller connect and payouts", () => {
    expect(
      buildClientBreadcrumbTrail("/dashboard/seller/connect", "selling").map((i) => i.label),
    ).toEqual(["Selling", "Payout setup"]);
    expect(
      buildClientBreadcrumbTrail("/dashboard/seller/payouts", "selling").map((i) => i.label),
    ).toEqual(["Selling", "Sold & payouts"]);
  });
});
