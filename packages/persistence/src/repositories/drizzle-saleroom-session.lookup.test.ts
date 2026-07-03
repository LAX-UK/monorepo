import { describe, expect, it, vi } from "vitest";
import { DrizzleSaleroomSessionLookup } from "./drizzle-saleroom-session.lookup.js";

function mockDb(row: {
  deliveryMode: string | null;
  allowOnlineBidsBeforeGoLive?: boolean | null;
  sessionStatus: string | null;
}) {
  const limit = vi.fn().mockResolvedValue([
    {
      deliveryMode: row.deliveryMode,
      allowOnlineBidsBeforeGoLive: row.allowOnlineBidsBeforeGoLive ?? false,
      sessionStatus: row.sessionStatus,
    },
  ]);
  return {
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
}

describe("DrizzleSaleroomSessionLookup", () => {
  it("returns true for hybrid sale with live saleroom session (anti-snipe skip)", async () => {
    const lookup = new DrizzleSaleroomSessionLookup(
      mockDb({ deliveryMode: "hybrid", sessionStatus: "live" }) as never,
    );
    await expect(lookup.shouldSkipAntiSnipeForLot("lot-1")).resolves.toBe(true);
  });

  it("returns false for online sale without saleroom session", async () => {
    const lookup = new DrizzleSaleroomSessionLookup(
      mockDb({ deliveryMode: "online", sessionStatus: null }) as never,
    );
    await expect(lookup.shouldSkipAntiSnipeForLot("lot-1")).resolves.toBe(false);
    await expect(lookup.shouldEnforceOnBlockGateForLot("lot-1")).resolves.toBe(false);
  });

  it("enforces on-block gate for gated hybrid before Go Live", async () => {
    const lookup = new DrizzleSaleroomSessionLookup(
      mockDb({
        deliveryMode: "hybrid",
        allowOnlineBidsBeforeGoLive: false,
        sessionStatus: "pending",
      }) as never,
    );
    await expect(lookup.shouldEnforceOnBlockGateForLot("lot-1")).resolves.toBe(true);
    await expect(lookup.shouldSkipAntiSnipeForLot("lot-1")).resolves.toBe(false);
  });

  it("does not enforce on-block gate for open hybrid before Go Live", async () => {
    const lookup = new DrizzleSaleroomSessionLookup(
      mockDb({
        deliveryMode: "hybrid",
        allowOnlineBidsBeforeGoLive: true,
        sessionStatus: "pending",
      }) as never,
    );
    await expect(lookup.shouldEnforceOnBlockGateForLot("lot-1")).resolves.toBe(false);
  });

  it("enforces on-block gate for open hybrid once session is live", async () => {
    const lookup = new DrizzleSaleroomSessionLookup(
      mockDb({
        deliveryMode: "hybrid",
        allowOnlineBidsBeforeGoLive: true,
        sessionStatus: "live",
      }) as never,
    );
    await expect(lookup.shouldEnforceOnBlockGateForLot("lot-1")).resolves.toBe(true);
  });

  it("isLotUnderLiveClerkSession mirrors anti-snipe skip for live saleroom", async () => {
    const lookup = new DrizzleSaleroomSessionLookup(
      mockDb({ deliveryMode: "hybrid", sessionStatus: "paused" }) as never,
    );
    await expect(lookup.isLotUnderLiveClerkSession("lot-1")).resolves.toBe(true);
  });
});
