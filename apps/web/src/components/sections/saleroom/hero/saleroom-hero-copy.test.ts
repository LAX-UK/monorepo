import {
  buildSaleroomHeroStats,
  resolveHeroCountdownEnd,
  resolveSaleroomHeroLiveTrailing,
} from "@/components/sections/saleroom/hero/saleroom-hero-copy";
import { describe, expect, it } from "vitest";

describe("saleroom-hero-copy", () => {
  it("resolves live lot count trailing copy", () => {
    expect(
      resolveSaleroomHeroLiveTrailing(
        { isLive: true, liveLotsCount: 1, itemsLabel: "120 lots" },
        { liveSession: null, catalogLotRefs: [] },
      ),
    ).toBe("· 1 lot live");
  });

  it("pluralises live lot count", () => {
    expect(
      resolveSaleroomHeroLiveTrailing(
        { isLive: true, liveLotsCount: 3, itemsLabel: "120 lots" },
        { liveSession: null, catalogLotRefs: [] },
      ),
    ).toBe("· 3 lots live");
  });

  it("shows on-block hybrid copy when session is live", () => {
    expect(
      resolveSaleroomHeroLiveTrailing(
        { isLive: true, liveLotsCount: 2, itemsLabel: "12 lots" },
        {
          liveSession: { status: "live", currentLotId: "lot-2" },
          catalogLotRefs: [
            { id: "lot-1", lotNumber: 1, title: "Lot A" },
            { id: "lot-2", lotNumber: 2, title: "Lot B" },
          ],
        },
      ),
    ).toBe("· Lot 2 on the block · 2 lots");
  });

  it("resolves countdown end from sale status", () => {
    expect(
      resolveHeroCountdownEnd({
        status: "active",
        startTime: "2026-01-01T00:00:00.000Z",
        endTime: "2026-01-02T00:00:00.000Z",
      }),
    ).toBe("2026-01-02T00:00:00.000Z");
    expect(
      resolveHeroCountdownEnd({
        status: "scheduled",
        startTime: "2026-01-01T00:00:00.000Z",
        endTime: "2026-01-02T00:00:00.000Z",
      }),
    ).toBe("2026-01-01T00:00:00.000Z");
    expect(
      resolveHeroCountdownEnd({
        status: "ended",
        startTime: "2026-01-01T00:00:00.000Z",
        endTime: "2026-01-02T00:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("builds hero stats with estimated total when present", () => {
    const stats = buildSaleroomHeroStats({
      itemsLabel: "40 lots",
      estimatedTotalLabel: "£8.4M",
    });
    expect(stats).toHaveLength(2);
    expect(stats[0]).toEqual(["Total Lots", "40 lots"]);
    expect(stats[1]).toEqual(["Est. Total", "£8.4M"]);
  });

  it("returns only total lots when estimated total is absent", () => {
    const stats = buildSaleroomHeroStats({
      itemsLabel: "40 lots",
    });
    expect(stats).toEqual([["Total Lots", "40 lots"]]);
  });

  it("returns empty trailing when sale is not live with lot counts", () => {
    expect(
      resolveSaleroomHeroLiveTrailing(
        { isLive: false, itemsLabel: "120 lots" },
        { liveSession: null, catalogLotRefs: [] },
      ),
    ).toBe("");
  });
});
