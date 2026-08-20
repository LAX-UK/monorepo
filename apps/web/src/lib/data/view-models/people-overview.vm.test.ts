import { describe, expect, it } from "vitest";
import { buildPeopleOverviewViewModel } from "./people-overview.vm";

describe("buildPeopleOverviewViewModel", () => {
  it("builds client health KPI tiles", () => {
    const vm = buildPeopleOverviewViewModel({
      summaryMetrics: {
        lifetimeSpend: 1250.5,
        lotsWon: 3,
        submissionsCount: 2,
        memberSinceIso: "2024-06-01T00:00:00.000Z",
      },
      readinessSnapshot: {
        identity: {
          emailVerified: true,
          kycStatus: "approved",
          securityStatusAvailable: true,
          twoFactorEnabled: true,
        },
        compliance: { amlHoldActive: false, amlReviewPending: false, latestAmlDecision: null },
        commerce: {
          legalEntityCount: 1,
          connectGapsCount: 0,
          lotsWon: 3,
          lifetimeSpendLabel: "£1,250.50",
        },
        nextAction: { label: "Review", href: "?tab=overview", tone: "ready" },
      },
      attentionCount: 2,
      payments: [
        {
          id: "pay_1",
          lotId: "lot_1",
          buyerId: "u1",
          sellerId: "s1",
          amount: "100.00",
          platformFee: "0",
          status: "pending",
          createdAt: new Date("2024-06-02T00:00:00.000Z"),
          xeroInvoiceNumber: null,
          xeroOnlineInvoiceUrl: null,
          xeroSyncStatus: null,
          xeroLastError: null,
        },
      ],
    });

    expect(vm.kpiTiles).toHaveLength(6);
    expect(vm.kpiTiles.map((tile) => tile.id)).toEqual([
      "lifetime",
      "outstanding",
      "completion",
      "won",
      "cases",
      "submissions",
    ]);
    expect(vm.kpiTiles[1]?.value).not.toBe("—");
    expect(vm.kpiTiles[2]?.value).toBe("100%");
  });

  it("builds staff KPI tiles without commerce metrics", () => {
    const vm = buildPeopleOverviewViewModel({
      isStaff: true,
      summaryMetrics: {
        lifetimeSpend: null,
        lotsWon: null,
        submissionsCount: null,
        memberSinceIso: "2024-01-01T00:00:00.000Z",
      },
      attentionCount: 0,
    });

    expect(vm.kpiTiles.length).toBe(3);
    expect(vm.kpiTiles.some((tile) => tile.id === "member")).toBe(true);
  });
});
