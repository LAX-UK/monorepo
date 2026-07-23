import {
  countSaleOverviewAttentionRows,
  mergeSaleOverviewAttentionRows,
} from "@/lib/admin/detail-board/merge-sale-overview-attention";
import type { SaleAttentionResult } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { buildSaleOverviewAttentionRows } from "./sale-overview.vm";

describe("mergeSaleOverviewAttentionRows", () => {
  it("deduplicates pending registrations when API and client both provide them", () => {
    const attention: SaleAttentionResult = {
      items: [
        {
          id: "pending-regs",
          kind: "pending_registrations",
          category: "Bidders",
          severity: "critical",
          count: 2,
          target: { tab: "registrations" },
        },
      ],
      totalCount: 1,
      truncated: false,
    };

    const rows = mergeSaleOverviewAttentionRows("sale-1", {
      fromReadiness: [],
      fromBlockers: [],
      fromPendingRegs: [
        {
          id: "pending-regs",
          title: "Pending bidder approvals",
          count: 2,
          category: "Bidders",
          severity: "critical",
          actionLabel: "Review registrations",
          iconKind: "registrations",
          href: "/admin/sales/sale-1/registrations",
        },
      ],
      fromApi: attention,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("pending-regs");
  });

  it("merges readiness, blockers, and API rows without dropping local sources", () => {
    const attention: SaleAttentionResult = {
      items: [
        {
          id: "api-only",
          kind: "incomplete_catalog_lots",
          category: "Catalog",
          severity: "high",
          count: 1,
          target: { tab: "lots" },
        },
      ],
      totalCount: 1,
      truncated: false,
    };

    const rows = mergeSaleOverviewAttentionRows("sale-1", {
      fromReadiness: [
        {
          id: "lots",
          title: "Add lots",
          count: 1,
          category: "Setup",
          severity: "critical",
          actionLabel: "Review",
          iconKind: "setup",
        },
      ],
      fromBlockers: [
        {
          id: "blocker-0",
          title: "Sale has registrations",
          count: 1,
          category: "Delete",
          severity: "high",
          actionLabel: "Review",
          iconKind: "delete",
        },
      ],
      fromPendingRegs: [],
      fromApi: attention,
    });

    expect(rows.map((row) => row.id)).toEqual(["blocker-0", "lots", "api-only"]);
  });
});

describe("buildSaleOverviewAttentionRows", () => {
  it("counts merged rows for tab badge parity", () => {
    const rows = buildSaleOverviewAttentionRows({
      saleId: "sale-1",
      readiness: {
        percent: 50,
        completeCount: 1,
        totalCount: 2,
        items: [
          {
            id: "lots",
            label: "Add lots",
            ok: false,
            severity: "required",
          },
        ],
      },
      deleteBlockers: ["Sale has registrations"],
      pendingRegistrationCount: 2,
      attention: null,
    });

    expect(rows).toHaveLength(3);
    expect(countSaleOverviewAttentionRows(rows)).toBe(4);
  });
});
