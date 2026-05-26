import { describe, expect, it, vi } from "vitest";
import { DrizzleBidRepository } from "./drizzle-bid.repository.js";

describe("DrizzleBidRepository.markWinningBid", () => {
  it("clears the existing winner before setting the new one", async () => {
    const clearWhere = vi.fn().mockResolvedValue(undefined);
    const clearSet = vi.fn().mockReturnValue({ where: clearWhere });
    const setWhere = vi.fn().mockResolvedValue(undefined);
    const setSet = vi.fn().mockReturnValue({ where: setWhere });
    const update = vi
      .fn()
      .mockReturnValueOnce({ set: clearSet })
      .mockReturnValueOnce({ set: setSet });
    const db = { update } as unknown as import("@auction/db").Database;

    await new DrizzleBidRepository(db).markWinningBid("lot-1", "bid-2");

    expect(update).toHaveBeenCalledTimes(2);
    expect(clearSet).toHaveBeenCalledWith({ isWinning: false });
    expect(setSet).toHaveBeenCalledWith({ isWinning: true });
    expect(setWhere).toHaveBeenCalledOnce();
  });
});
