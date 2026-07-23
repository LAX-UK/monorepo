import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { describe, expect, it } from "vitest";
import { buildStaffHeaderAttentionItems } from "./build-staff-header-attention-items";

describe("buildStaffHeaderAttentionItems", () => {
  it("returns finance and compliance items the viewer can access", () => {
    const items = buildStaffHeaderAttentionItems(
      {
        ...EMPTY_ADMIN_NAV_COUNTS,
        manualReviewCount: 2,
        disputesOpen: 1,
        amlScreeningsPending: 3,
      },
      "staff",
      "super_admin",
    );

    expect(items.map((i) => i.id)).toEqual([
      "nav-manual-review",
      "nav-disputes",
      "nav-aml-screenings",
    ]);
    expect(items.find((i) => i.id === "nav-manual-review")).toMatchObject({
      label: "Payments — manual review",
      count: 2,
      href: "/admin/payments?manualReview=1",
    });
  });

  it("excludes submissions from header attention", () => {
    const items = buildStaffHeaderAttentionItems(
      {
        ...EMPTY_ADMIN_NAV_COUNTS,
        submissionsPending: 9,
        manualReviewCount: 1,
      },
      "staff",
      "super_admin",
    );

    expect(items.map((i) => i.id)).not.toContain("nav-submissions");
    expect(items.map((i) => i.id)).toContain("nav-manual-review");
  });

  it("filters items by capability", () => {
    const items = buildStaffHeaderAttentionItems(
      {
        ...EMPTY_ADMIN_NAV_COUNTS,
        manualReviewCount: 4,
        amlScreeningsPending: 2,
      },
      "staff",
      "client_advisor",
    );

    expect(items).toHaveLength(0);
  });

  it("returns empty list when all counts are zero", () => {
    expect(buildStaffHeaderAttentionItems(EMPTY_ADMIN_NAV_COUNTS, "staff", "super_admin")).toEqual(
      [],
    );
  });
});
