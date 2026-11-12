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
      ["administrator"],
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
      ["administrator"],
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
      ["client_services"],
    );

    expect(items).toHaveLength(0);
  });

  it("returns empty list when all counts are zero", () => {
    expect(
      buildStaffHeaderAttentionItems(EMPTY_ADMIN_NAV_COUNTS, "staff", ["administrator"]),
    ).toEqual([]);
  });

  it("tells the people who run private sales when a settled deal's artwork is not marked sold", () => {
    const counts = { ...EMPTY_ADMIN_NAV_COUNTS, privateSalesAttention: 2 };
    const [item] = buildStaffHeaderAttentionItems(counts, "staff", ["sales_manager"]);
    expect(item).toMatchObject({
      id: "nav-private-sales-attention",
      label: "2 settled private sales not marked sold",
      count: 2,
      href: "/admin/private-sales?view=needs_attention",
      hint: "The artwork's record needs marking sold",
    });
  });

  it("warns of a possible double sale when the register shows an artwork elsewhere", () => {
    const counts = { ...EMPTY_ADMIN_NAV_COUNTS, privateSalesAttention: 1, privateSalesUrgent: 1 };
    const [item] = buildStaffHeaderAttentionItems(counts, "staff", ["administrator"]);
    expect(item?.label).toBe("1 settled private sale not marked sold");
    expect(item?.hint).toContain("may have been sold twice");
  });

  it("does not show it to people who may only view deals", () => {
    const counts = { ...EMPTY_ADMIN_NAV_COUNTS, privateSalesAttention: 2 };
    for (const role of ["finance", "client_services"] as const) {
      expect(buildStaffHeaderAttentionItems(counts, "staff", [role])).toEqual([]);
    }
  });
});
