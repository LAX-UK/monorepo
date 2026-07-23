import { buildPayoutsListPageModel } from "@/lib/admin/build-payouts-list-page-model";
import { buildPayoutsListKpiTiles } from "@/lib/admin/finance/build-payouts-list-kpi-tiles";
import { EMPTY_ADMIN_PAYOUT_LIST_SUMMARY } from "@/lib/data/http/admin-payouts.shared";
import { describe, expect, it } from "vitest";

describe("buildPayoutsListPageModel", () => {
  it("builds drawer href and status chips", () => {
    const model = buildPayoutsListPageModel({
      status: "scheduled",
      payout: "payout-1",
    });

    expect(model.hasFilters).toBe(true);
    expect(model.selectedPayoutId).toBe("payout-1");
    expect(model.buildDrawerHref("payout-2")).toContain("payout=payout-2");
    expect(model.statusChipSpecs.find((chip) => chip.id === "scheduled")?.active).toBe(true);
  });
});

describe("buildPayoutsListKpiTiles", () => {
  it("builds six dashboard tiles from summary", () => {
    const tiles = buildPayoutsListKpiTiles({
      summary: {
        ...EMPTY_ADMIN_PAYOUT_LIST_SUMMARY,
        scheduled: 2,
        inTransit: 1,
        paid: 4,
        totalNet: "500.00",
        failed: 1,
        clawbackPending: 0,
        readiness: {
          ...EMPTY_ADMIN_PAYOUT_LIST_SUMMARY.readiness,
          blockerPayoutCount: 1,
        },
      },
      trend: { currentTotal: 3, priorTotal: 1, dailyCounts: [1, 2, 3] },
      periodDays: 30,
    });

    expect(tiles).toHaveLength(6);
    expect(tiles[1]?.label).toBe("Scheduled");
  });
});
