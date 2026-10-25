import { describe, expect, it } from "vitest";
import { buildClientOverviewStats } from "./people-overview.vm";

const summaryMetrics = {
  lifetimeSpend: 1250.5,
  lotsWon: 3,
  submissionsCount: 2,
  memberSinceIso: "2024-06-01T00:00:00.000Z",
};

const pending = {
  id: "pay_1",
  lotId: "lot_1",
  buyerId: "u1",
  sellerId: "s1",
  amount: "100.00",
  platformFee: "0",
  status: "pending" as const,
  createdAt: new Date("2024-06-02T00:00:00.000Z"),
  xeroInvoiceNumber: null,
  xeroOnlineInvoiceUrl: null,
  xeroSyncStatus: null,
  xeroLastError: null,
};

describe("buildClientOverviewStats", () => {
  it("gives the four headline numbers with what is owed", () => {
    const stats = buildClientOverviewStats({ summaryMetrics, payments: [pending] });

    expect(stats.map((stat) => stat.id)).toEqual(["lifetime", "outstanding", "won", "submissions"]);
    expect(stats[0]?.value).toContain("1,250.50");
    expect(stats[1]?.value).toContain("100.00");
    expect(stats[1]?.hint).toBe("Payment due");
    expect(stats[2]?.value).toBe("3");
  });

  it("shows a dash rather than zero for what is not known", () => {
    const stats = buildClientOverviewStats({
      summaryMetrics: { ...summaryMetrics, lifetimeSpend: null, lotsWon: null },
    });

    expect(stats[0]?.value).toBe("—");
    expect(stats[1]?.value).toBe("—");
    expect(stats[1]?.hint).toBe("Nothing due");
    expect(stats[2]?.value).toBe("—");
  });
});
