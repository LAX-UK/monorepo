import { describe, expect, it } from "vitest";
import { groupAttentionRows } from "./group-attention-rows";

describe("groupAttentionRows", () => {
  it("groups rows by domain in stable order", () => {
    const groups = groupAttentionRows([
      {
        id: "nav-submissions",
        domain: "Catalog",
        title: "3 submissions",
        hint: "hint",
        href: "/admin/submissions",
        ctaLabel: "Open",
      },
      {
        id: "nav-manual-review",
        domain: "Finance",
        title: "2 payments",
        hint: "hint",
        href: "/admin/payments",
        ctaLabel: "Open",
      },
      {
        id: "nav-aml-screenings",
        domain: "Compliance",
        title: "1 AML",
        hint: "hint",
        href: "/admin/compliance/aml",
        ctaLabel: "Open",
      },
    ]);

    expect(groups.map((g) => g.domain)).toEqual(["Finance", "Compliance", "Catalog"]);
    expect(groups[0]?.items).toHaveLength(1);
  });

  it("infers domain from href when domain is omitted", () => {
    const groups = groupAttentionRows([
      {
        id: "feed-1",
        title: "Payout issue",
        hint: "hint",
        href: "/admin/payouts?status=failed",
        ctaLabel: "Open",
      },
    ]);
    expect(groups[0]?.domain).toBe("Finance");
  });
});
