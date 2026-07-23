import { describe, expect, it, vi } from "vitest";
import { AdminAmlListQueryService } from "./admin-aml-list-query.service.js";

describe("AdminAmlListQueryService", () => {
  it("returns rows with truthful pending queue summary", async () => {
    const screenings = {
      listByReviewStatus: vi.fn().mockResolvedValue([{ id: "s1" }]),
      summarizePendingQueue: vi.fn().mockResolvedValue({
        total: 4,
        awaitingTriage: 3,
        triaged: 1,
        escalated: 1,
      }),
    };
    const service = new AdminAmlListQueryService(screenings as never);
    const page = await service.getPage({ limit: 50, offset: 0 });
    expect(page.rows).toHaveLength(1);
    expect(page.summary).toEqual({
      total: 4,
      awaitingTriage: 3,
      triaged: 1,
      escalated: 1,
    });
    expect(page.total).toBe(4);
  });

  it("returns pending screening by id", async () => {
    const screenings = {
      findById: vi.fn().mockResolvedValue({ id: "s1", reviewStatus: "pending" }),
    };
    const service = new AdminAmlListQueryService(screenings as never);
    await expect(service.getPendingById("s1")).resolves.toEqual({
      id: "s1",
      reviewStatus: "pending",
    });
  });

  it("returns null for cleared screening", async () => {
    const screenings = {
      findById: vi.fn().mockResolvedValue({ id: "s1", reviewStatus: "cleared" }),
    };
    const service = new AdminAmlListQueryService(screenings as never);
    await expect(service.getPendingById("s1")).resolves.toBeNull();
  });
});
