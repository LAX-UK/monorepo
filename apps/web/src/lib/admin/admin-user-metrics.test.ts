import type { AdminPaymentRow } from "@/lib/data/http/admin.server";
import { describe, expect, it } from "vitest";
import { buildClientSummaryMetrics, sumCapturedPayments } from "./admin-user-metrics";

describe("sumCapturedPayments", () => {
  it("sums only captured payment amounts", () => {
    const payments = [
      { status: "captured", amount: "10.50" },
      { status: "pending", amount: "99.00" },
      { status: "captured", amount: "2.00" },
    ] as AdminPaymentRow[];

    expect(sumCapturedPayments(payments)).toBe(12.5);
  });
});

describe("buildClientSummaryMetrics", () => {
  it("nulls out zero lifetime spend and submission counts", () => {
    expect(
      buildClientSummaryMetrics({
        lifetimeSpend: 0,
        lotsWon: 2,
        submissionsCount: 0,
        memberSinceIso: "2024-01-01T00:00:00.000Z",
      }),
    ).toEqual({
      lifetimeSpend: null,
      lotsWon: 2,
      submissionsCount: null,
      memberSinceIso: "2024-01-01T00:00:00.000Z",
    });
  });
});
