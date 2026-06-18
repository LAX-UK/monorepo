import { describe, expect, it, vi } from "vitest";
import { DrizzleBidRepository } from "./drizzle-bid.repository.js";

describe("DrizzleBidRepository.markWinningBid", () => {
  it("clears the current winner then promotes the new bid in two execute calls", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const db = { execute } as unknown as import("@auction/db").Database;

    const lotId = "00000000-0000-4000-8000-000000000001";
    const bidId = "00000000-0000-4000-8000-000000000002";

    await new DrizzleBidRepository(db).markWinningBid(lotId, bidId);

    expect(execute).toHaveBeenCalledTimes(2);
    const clearSql = JSON.stringify(execute.mock.calls[0]?.[0]);
    const promoteSql = JSON.stringify(execute.mock.calls[1]?.[0]);
    expect(clearSql).toContain("is_winning = false");
    expect(clearSql).toContain(lotId);
    expect(promoteSql).toContain("is_winning = true");
    expect(promoteSql).toContain(lotId);
    expect(promoteSql).toContain(bidId);
  });
});

describe("DrizzleBidRepository.clearWinningBid", () => {
  it("clears the current winner for the lot", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const db = { execute } as unknown as import("@auction/db").Database;

    const lotId = "00000000-0000-4000-8000-000000000003";

    await new DrizzleBidRepository(db).clearWinningBid(lotId);

    expect(execute).toHaveBeenCalledTimes(1);
    const clearSql = JSON.stringify(execute.mock.calls[0]?.[0]);
    expect(clearSql).toContain("is_winning = false");
    expect(clearSql).toContain(lotId);
  });
});
