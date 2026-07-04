import { DrizzleAdminManualReviewPaymentEnrichmentReader } from "@auction/persistence/repositories";
import { describe, expect, it, vi } from "vitest";

describe("DrizzleAdminManualReviewPaymentEnrichmentReader", () => {
  it("batch-loads domain events and attaches manual review reason", async () => {
    const rows = [
      {
        paymentId: "pay-1",
        lotId: "lot-1",
        lotTitle: "Painting",
        lotNumber: 1,
        winnerUserId: "buyer-1",
        winnerEmail: "buyer@example.com",
        sellerLegalEntityId: "le-1",
        sellerDisplayName: "Seller",
        sellerStatus: "archived",
        sellerArchivedAt: new Date("2026-01-01T00:00:00Z"),
        amount: "5000.00",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ];

    const select = vi
      .fn()
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([
          {
            aggregateId: "le-1",
            payload: { reason: "seller_requested" },
            occurredAt: new Date("2026-01-02T00:00:00Z"),
            id: 10,
          },
        ]),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([
          {
            aggregateId: "pay-1",
            payload: { reason: "seller_archived" },
            id: 11,
          },
        ]),
      });

    const enricher = new DrizzleAdminManualReviewPaymentEnrichmentReader({ select } as never);
    const enriched = await enricher.enrich(rows);

    expect(enriched).toHaveLength(1);
    expect(enriched[0]?.manualReviewReason).toBe("seller_archived");
    expect(enriched[0]?.archiveReason).toBe("seller_requested");
    expect(select).toHaveBeenCalledTimes(2);
  });
});
