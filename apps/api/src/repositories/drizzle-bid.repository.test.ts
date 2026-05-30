import { describe, expect, it, vi } from "vitest";
import { DrizzleBidRepository } from "./drizzle-bid.repository.js";

describe("DrizzleBidRepository.markWinningBid", () => {
  it("updates only the current winner and new winner in one execute call", async () => {
    const execute = vi.fn().mockResolvedValue(undefined);
    const db = { execute } as unknown as import("@auction/db").Database;

    const lotId = "00000000-0000-4000-8000-000000000001";
    const bidId = "00000000-0000-4000-8000-000000000002";

    await new DrizzleBidRepository(db).markWinningBid(lotId, bidId);

    expect(execute).toHaveBeenCalledOnce();
    const serialized = JSON.stringify(execute.mock.calls[0]?.[0]);
    expect(serialized).toContain("is_winning");
    expect(serialized).toContain(lotId);
    expect(serialized).toContain(bidId);
  });
});
