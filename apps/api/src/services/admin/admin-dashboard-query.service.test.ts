import { describe, expect, it, vi } from "vitest";
import { AdminDashboardQueryService } from "./admin-dashboard-query.service.js";

describe("AdminDashboardQueryService.listManualReviewPayments", () => {
  it("enriches source_of_funds_required rows with pending case id", async () => {
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
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ payload: { reason: "source_of_funds_required" } }]),
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
    const svc = new AdminDashboardQueryService(db);
    const rows = await svc.listManualReviewPayments();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.manualReviewReason).toBe("source_of_funds_required");
    expect(rows[0]?.sourceOfFundsCaseId).toBe("sof-pending-1");
  });
});
