import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IAdminDomainEventQueryService } from "../interfaces/admin-routes.js";
import { AdminDisputeCaseQueryService } from "./admin-dispute-case-query.service.js";

const mockListRedacted = vi.fn<IAdminDomainEventQueryService["listRedacted"]>();

const mockDb = {
  select: vi.fn(),
};

function chainSelect(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
  mockDb.select.mockReturnValue(chain);
  return chain;
}

describe("AdminDisputeCaseQueryService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListRedacted.mockResolvedValue([
      {
        id: 1,
        aggregateType: "payment",
        aggregateId: "pay-1",
        eventType: "payment.dispute_opened",
        payload: {
          stripeDisputeId: "dp_1",
          amountCents: 5000,
          currency: "gbp",
          sellerLegalEntityId: "le-1",
          reason: "fraudulent",
        },
        actorUserId: null,
        actingLegalEntityId: null,
        occurredAt: new Date("2026-01-01T10:00:00Z"),
      },
      {
        id: 2,
        aggregateType: "payment",
        aggregateId: "pay-2",
        eventType: "payment.dispute_opened",
        payload: {
          stripeDisputeId: "dp_2",
          amountCents: 3000,
          currency: "gbp",
          sellerLegalEntityId: "le-2",
        },
        actorUserId: null,
        actingLegalEntityId: null,
        occurredAt: new Date("2026-01-02T10:00:00Z"),
      },
      {
        id: 3,
        aggregateType: "payment",
        aggregateId: "pay-2",
        eventType: "payment.dispute_closed",
        payload: {
          stripeDisputeId: "dp_2",
          outcome: "won",
        },
        actorUserId: null,
        actingLegalEntityId: null,
        occurredAt: new Date("2026-01-03T10:00:00Z"),
      },
    ]);
    chainSelect([]);
  });

  it("lists cases with summary and pagination", async () => {
    chainSelect([
      { id: "pay-1", lotId: "lot-1", buyerId: "buyer-1", sellerLegalEntityId: "le-1" },
      { id: "pay-2", lotId: "lot-2", buyerId: "buyer-2", sellerLegalEntityId: "le-2" },
    ]);
    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { id: "pay-1", lotId: "lot-1", buyerId: "buyer-1", sellerLegalEntityId: "le-1" },
          { id: "pay-2", lotId: "lot-2", buyerId: "buyer-2", sellerLegalEntityId: "le-2" },
        ]),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { id: "lot-1", title: "Vase" },
          { id: "lot-2", title: "Bowl" },
        ]),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { id: "buyer-1", name: "Alice", email: "alice@example.com" },
          { id: "buyer-2", name: null, email: "bob@example.com" },
        ]),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          { id: "le-1", displayName: "Seller One" },
          { id: "le-2", displayName: "Seller Two" },
        ]),
      });

    const svc = new AdminDisputeCaseQueryService(
      { listRedacted: mockListRedacted },
      mockDb as never,
    );

    const result = await svc.listCases({ limit: 1, offset: 0 });
    expect(result.rows).toHaveLength(1);
    expect(result.hasNextPage).toBe(true);
    expect(result.summary).toEqual({ open: 1, underReview: 0, won: 1, lost: 0, closed: 0 });
    expect(result.rows[0]?.stripeDisputeId).toBe("dp_2");
    expect(result.rows[0]?.lotTitle).toBe("Bowl");
    expect(result.rows[0]?.timelineEvents?.length).toBeGreaterThan(0);
  });

  it("reuses cache for countOpenCases within TTL", async () => {
    chainSelect([]);
    const svc = new AdminDisputeCaseQueryService(
      { listRedacted: mockListRedacted },
      mockDb as never,
    );

    await svc.countOpenCases();
    await svc.countOpenCases();
    expect(mockListRedacted).toHaveBeenCalledTimes(1);
  });

  it("filters open cases only", async () => {
    chainSelect([]);
    const svc = new AdminDisputeCaseQueryService(
      { listRedacted: mockListRedacted },
      mockDb as never,
    );

    const result = await svc.listCases({ limit: 50, offset: 0, status: "open" });
    expect(result.rows.every((r) => r.status === "open")).toBe(true);
    expect(result.rows).toHaveLength(1);
  });
});
