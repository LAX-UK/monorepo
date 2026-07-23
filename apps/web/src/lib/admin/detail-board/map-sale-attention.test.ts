import type { SaleAttentionResult } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { mapSaleAttentionToRows } from "./map-sale-attention";

const saleId = "sale-1";

describe("mapSaleAttentionToRows", () => {
  it("maps semantic items to detail rows with hrefs and copy", () => {
    const result: SaleAttentionResult = {
      items: [
        {
          id: "pending-regs",
          kind: "pending_registrations",
          category: "Bidders",
          severity: "critical",
          count: 3,
          target: { tab: "registrations" },
        },
        {
          id: "setup-sale-lots",
          kind: "setup_readiness",
          category: "Setup",
          severity: "critical",
          count: 1,
          target: { tab: "lots" },
        },
        {
          id: "delete-blocker-0",
          kind: "delete_blocker",
          category: "Delete",
          severity: "high",
          count: 1,
          target: { tab: "overview" },
          refs: ["Sale has active lots"],
        },
      ],
      totalCount: 3,
      truncated: false,
    };

    const rows = mapSaleAttentionToRows(saleId, result);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      id: "pending-regs",
      title: "3 pending bidder approvals",
      count: 3,
      href: `/admin/sales/${saleId}/registrations`,
      actionLabel: "Review registrations",
    });
    expect(rows[1]).toMatchObject({
      id: "setup-sale-lots",
      title: "At least one lot attached",
      href: `/admin/sales/${saleId}/lots`,
    });
    expect(rows[2]).toMatchObject({
      id: "delete-blocker-0",
      title: "Sale has active lots",
    });
  });

  it("appends +N more row when truncated", () => {
    const result: SaleAttentionResult = {
      items: [
        {
          id: "pending-regs",
          kind: "pending_registrations",
          category: "Bidders",
          severity: "critical",
          count: 1,
          target: { tab: "registrations" },
        },
      ],
      totalCount: 4,
      truncated: true,
    };

    const rows = mapSaleAttentionToRows(saleId, result);

    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({
      id: "attention-truncated",
      title: "3 more items need attention",
      count: 3,
      severity: "medium",
    });
  });
});
