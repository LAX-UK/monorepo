import {
  EMPTY_ADMIN_PAYOUT_LIST_SUMMARY,
  parseAdminPayoutsPageBody,
  parseAdminSettlementPreviewBody,
} from "@/lib/data/http/admin-payouts.shared";
import { describe, expect, it } from "vitest";

describe("parseAdminPayoutsPageBody", () => {
  it("parses paginated envelope with summary", () => {
    const result = parseAdminPayoutsPageBody(
      {
        data: [
          {
            id: "p1",
            legalEntityId: "le1",
            periodStart: "2026-01-01",
            periodEnd: "2026-01-31",
            grossAmount: "100",
            platformFee: "10",
            stripeFee: "2",
            netAmount: "88",
            currency: "GBP",
            status: "scheduled",
            stripeTransferId: null,
            xeroBillId: null,
            failureReason: null,
            processedAt: null,
            statementUrl: null,
            statementGenerationError: null,
            createdAt: "2026-01-15T00:00:00.000Z",
          },
        ],
        meta: {
          total: 12,
          limit: 25,
          offset: 0,
          summary: {
            total: 12,
            scheduled: 4,
            inTransit: 2,
            paid: 5,
            failed: 1,
            reversed: 0,
            clawbackPending: 0,
            totalNet: "880.00",
            readiness: EMPTY_ADMIN_PAYOUT_LIST_SUMMARY.readiness,
          },
        },
      },
      { limit: 25, offset: 0 },
    );

    expect(result.total).toBe(12);
    expect(result.summary.scheduled).toBe(4);
    expect(result.hasNextPage).toBe(true);
  });
});

describe("parseAdminSettlementPreviewBody", () => {
  it("parses pending preview and open payout", () => {
    const result = parseAdminSettlementPreviewBody({
      data: {
        pending: {
          pendingGross: "100.00",
          pendingPlatformFee: "10.00",
          pendingNet: "90.00",
          paymentCount: 3,
          currency: "GBP",
        },
        openPayout: null,
      },
    });

    expect(result.pending.paymentCount).toBe(3);
    expect(result.openPayout).toBeNull();
  });
});
