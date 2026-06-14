import { describe, expect, it, vi } from "vitest";
import { DrizzleSaleroomSessionLookup } from "./drizzle-saleroom-session.lookup.js";

describe("DrizzleSaleroomSessionLookup", () => {
  it("returns true for hybrid sale with live saleroom session", async () => {
    const limit = vi.fn().mockResolvedValue([{ deliveryMode: "hybrid", sessionStatus: "live" }]);
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({ limit }),
            }),
          }),
        }),
      }),
    };
    const lookup = new DrizzleSaleroomSessionLookup(db as never);
    await expect(lookup.shouldSkipAntiSnipeForLot("lot-1")).resolves.toBe(true);
  });

  it("returns false for online sale without saleroom session", async () => {
    const limit = vi.fn().mockResolvedValue([{ deliveryMode: "online", sessionStatus: null }]);
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          leftJoin: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({ limit }),
            }),
          }),
        }),
      }),
    };
    const lookup = new DrizzleSaleroomSessionLookup(db as never);
    await expect(lookup.shouldSkipAntiSnipeForLot("lot-1")).resolves.toBe(false);
  });
});
