import { describe, expect, it } from "vitest";
import { mergeSaleOverviewAttentionRows } from "./merge-sale-overview-attention";
import type { DetailAttentionRow } from "./types";

function row(id: string, title: string): DetailAttentionRow {
  return {
    id,
    title,
    count: 1,
    category: "Setup",
    severity: "high",
    actionLabel: "Review",
    iconKind: "setup",
  };
}

describe("mergeSaleOverviewAttentionRows", () => {
  it("shows a setup check once when the readiness list and the API both report it", () => {
    const rows = mergeSaleOverviewAttentionRows("sale-1", {
      fromReadiness: [row("sale_start_future", "Opening time must be in the future")],
      fromBlockers: [],
      fromPendingRegs: [],
      fromApi: {
        items: [
          {
            id: "setup-sale-sale_start_future",
            kind: "setup_readiness",
            category: "Setup",
            severity: "critical",
            count: 1,
            target: { tab: "schedule" },
          },
        ],
        totalCount: 1,
        truncated: false,
      },
    });
    expect(rows.map((r) => r.title)).toEqual(["Opening time must be in the future"]);
  });
});
