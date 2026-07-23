import { describe, expect, it, vi } from "vitest";
import type { WebsiteEventContext } from "../../lib/marketing-event-factory.js";
import { UserWatchlistHttpApplicationService } from "./user-watchlist-http-application.service.js";

function marketingContextFixture(): WebsiteEventContext {
  return {
    get: () => undefined,
    req: { header: () => undefined },
  };
}

describe("UserWatchlistHttpApplicationService", () => {
  it("returns 404 when lot does not exist on add", async () => {
    const svc = new UserWatchlistHttpApplicationService({
      watchlistService: {} as never,
      userDashboardReadService: {} as never,
      lotService: { getById: vi.fn().mockResolvedValue(null) } as never,
      marketingEventService: { emit: vi.fn() } as never,
      attributionStore: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } as never,
      marketingAttributionEnabled: false,
      artistWatchlistService: {} as never,
      savedSearchService: {} as never,
    });

    const response = await svc.addWatchlistLot({
      userId: "u1",
      body: { lotId: "00000000-0000-4000-8000-000000000001" },
      marketingContext: marketingContextFixture(),
    });

    expect(response.status).toBe(404);
  });
});
