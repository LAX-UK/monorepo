import {
  DrizzleAdminManualReviewPaymentEnrichmentReader,
  DrizzleAdminManualReviewPaymentReader,
} from "@auction/persistence/repositories";
import { describe, expect, it, vi } from "vitest";
import { AdminManualReviewPaymentQueryService } from "./admin-manual-review-payment-query.service.js";

describe("AdminManualReviewPaymentQueryService.listManualReviewPayments", () => {
  it("enriches source_of_funds_required rows with pending case id via batch domain events", async () => {
    const paymentRows = [
      {
        paymentId: "pay-1",
        lotId: "lot-1",
        lotTitle: "Painting",
        lotNumber: 1,
        winnerUserId: "buyer-1",
        winnerEmail: "buyer@example.com",
        sellerLegalEntityId: "le-1",
        sellerDisplayName: "Seller",
        sellerStatus: "active",
        sellerArchivedAt: null,
        amount: "5000.00",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ];

    const select = vi
      .fn()
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(paymentRows),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([
          {
            aggregateId: "pay-1",
            payload: { reason: "source_of_funds_required" },
            id: 2,
          },
        ]),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi
          .fn()
          .mockResolvedValue([
            { id: "sof-pending-1", userId: "buyer-1", createdAt: new Date("2026-01-02T00:00:00Z") },
          ]),
      });

    const db = { select } as never;
    const svc = new AdminManualReviewPaymentQueryService(
      new DrizzleAdminManualReviewPaymentReader(db),
      new DrizzleAdminManualReviewPaymentEnrichmentReader(db),
    );
    const rows = await svc.listManualReviewPayments();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.manualReviewReason).toBe("source_of_funds_required");
    expect(rows[0]?.sourceOfFundsCaseId).toBe("sof-pending-1");
    expect(select).toHaveBeenCalledTimes(4);
  });
});

describe("AdminManualReviewPaymentQueryService.countManualReviewPayments", () => {
  it("returns count from aggregate query", async () => {
    const select = vi.fn().mockReturnValueOnce({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ n: 3 }]),
    });
    const db = { select } as never;
    const svc = new AdminManualReviewPaymentQueryService(
      new DrizzleAdminManualReviewPaymentReader(db),
      new DrizzleAdminManualReviewPaymentEnrichmentReader(db),
    );

    await expect(svc.countManualReviewPayments()).resolves.toBe(3);
  });
});
