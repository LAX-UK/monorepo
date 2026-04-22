import { describe, expect, it, vi } from "vitest";
import type { ISaleExistenceReader, ISaleFollowRepository } from "./interfaces/sale-follow.js";
import { SaleFollowService } from "./sale-follow.service.js";

function makeRepo(overrides: Partial<ISaleFollowRepository> = {}): ISaleFollowRepository {
  return {
    add: vi.fn(async (userId, saleId) => ({
      id: "f-1",
      userId,
      saleId,
      createdAt: new Date(),
    })),
    remove: vi.fn(async () => undefined),
    exists: vi.fn(async () => false),
    countForSale: vi.fn(async () => 0),
    ...overrides,
  };
}

describe("SaleFollowService", () => {
  it("returns null when sale does not exist (no write attempted)", async () => {
    const repo = makeRepo();
    const sales: ISaleExistenceReader = { findById: vi.fn(async () => null) };
    const svc = new SaleFollowService(repo, sales);
    const res = await svc.follow("user-1", "sale-unknown");
    expect(res).toBeNull();
    expect(repo.add).not.toHaveBeenCalled();
  });

  it("follow is idempotent — repeated calls return the persisted row", async () => {
    const row = {
      id: "f-1",
      userId: "user-1",
      saleId: "sale-1",
      createdAt: new Date(),
    };
    const repo = makeRepo({ add: vi.fn(async () => row) });
    const sales: ISaleExistenceReader = {
      findById: vi.fn(async () => ({ id: "sale-1" })),
    };
    const svc = new SaleFollowService(repo, sales);
    const first = await svc.follow("user-1", "sale-1");
    const second = await svc.follow("user-1", "sale-1");
    expect(first).toEqual(row);
    expect(second).toEqual(row);
    expect(repo.add).toHaveBeenCalledTimes(2);
  });

  it("unfollow delegates to repository", async () => {
    const repo = makeRepo();
    const sales: ISaleExistenceReader = { findById: vi.fn(async () => ({ id: "sale-1" })) };
    const svc = new SaleFollowService(repo, sales);
    await svc.unfollow("user-1", "sale-1");
    expect(repo.remove).toHaveBeenCalledWith("user-1", "sale-1");
  });
});
