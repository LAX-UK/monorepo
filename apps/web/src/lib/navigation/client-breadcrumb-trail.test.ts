import { buildClientBreadcrumbTrail } from "@/lib/navigation/client-breadcrumb-trail";
import { describe, expect, it } from "vitest";

describe("buildClientBreadcrumbTrail", () => {
  it("labels purchases from nav", () => {
    expect(buildClientBreadcrumbTrail("/dashboard/purchases")).toEqual([{ label: "Purchases" }]);
  });

  it("labels organisation detail without raw uuid", () => {
    const trail = buildClientBreadcrumbTrail("/dashboard/organisations/org-uuid-123");
    expect(trail.map((i) => i.label)).toEqual(["Organisations", "Organisation"]);
    expect(trail[0]?.href).toBe("/dashboard/organisations");
  });

  it("labels organisation tab routes without Detail fallback", () => {
    expect(
      buildClientBreadcrumbTrail("/dashboard/organisations/org-uuid-123/members").map(
        (i) => i.label,
      ),
    ).toEqual(["Organisations", "Organisation", "Members"]);
    expect(
      buildClientBreadcrumbTrail("/dashboard/organisations/org-uuid-123/connect").map(
        (i) => i.label,
      ),
    ).toEqual(["Organisations", "Organisation", "Payout setup"]);
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

  it("title-cases settings leaf segments", () => {
    expect(buildClientBreadcrumbTrail("/dashboard/settings/security/two-factor")).toEqual([
      { label: "Bid settings", href: "/dashboard/settings" },
      { label: "Two-factor authentication" },
    ]);
  });

  it("labels settings account confirm", () => {
    expect(buildClientBreadcrumbTrail("/dashboard/settings/account/confirm")).toEqual([
      { label: "Bid settings", href: "/dashboard/settings" },
      { label: "Confirm changes" },
    ]);
  });

  it("never falls through to Detail on covered nested routes", () => {
    const paths = [
      "/dashboard/organisations/org-1/documents",
      "/dashboard/invitations/review/x",
      "/dashboard/legal-entities/le/payouts/p/st/statement",
      "/dashboard/settings/account/confirm",
    ];
    for (const path of paths) {
      const labels = buildClientBreadcrumbTrail(path).map((i) => i.label);
      expect(labels).not.toContain("Detail");
    }
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
