import { describe, expect, it, vi } from "vitest";
import { DrizzleSaleroomDisplaySnapshotReader } from "../repositories/drizzle-saleroom-display-snapshot.reader.js";
import { DisplaySnapshotReader } from "./display-snapshot-reader.service.js";

function chain(resolved: unknown[]) {
  const result = Promise.resolve(resolved);
  const orderBy = vi.fn().mockReturnValue(result);
  const limit = vi.fn().mockReturnValue(result);
  const whereResult = Object.assign(result, { limit, orderBy });
  const where = vi.fn().mockReturnValue(whereResult);
  const from = vi.fn().mockReturnValue({ where, limit, orderBy });
  return { from, where, limit, orderBy };
}

describe("DisplaySnapshotReader", () => {
  it("returns null for non-saleroom delivery modes", async () => {
    const saleChain = chain([
      { id: "sale-1", title: "Sale", deliveryMode: "online", coverImages: [] },
    ]);
    const db = { select: vi.fn().mockReturnValue(saleChain) };
    const reader = new DisplaySnapshotReader({
      reader: new DrizzleSaleroomDisplaySnapshotReader(db as never),
      mediaUrlResolver: { resolve: vi.fn() } as never,
    });

    const snap = await reader.getSnapshot("sale-1");
    expect(snap).toBeNull();
  });

  it("includes next lot, progress, estimate, and cover when live", async () => {
    let selectCall = 0;
    const db = {
      select: vi.fn(() => {
        selectCall += 1;
        if (selectCall === 1) {
          return chain([
            {
              id: "sale-1",
              title: "Hybrid sale",
              deliveryMode: "hybrid",
              coverImages: ["cover-key"],
            },
          ]);
        }
        if (selectCall === 2) {
          return chain([
            {
              status: "live",
              currentLotId: "lot-1",
              displayOverlay: null,
              startedAt: new Date("2026-06-17T14:00:00.000Z"),
            },
          ]);
        }
        if (selectCall === 3) {
          return chain([
            {
              id: "lot-1",
              lotNumber: 1,
              title: "Meridian Drift",
              images: ["img-key"],
              currentPrice: "500.00",
              marketingDetails: {
                estimate: { low: "400.00", high: "600.00", currency: "GBP" },
              },
              minBidIncrement: "25.00",
            },
          ]);
        }
        if (selectCall === 4) {
          return chain([{ count: 2 }]);
        }
        if (selectCall === 5) {
          return chain([{ bidderId: "user-1" }]);
        }
        if (selectCall === 6) {
          return chain([{ paddleNumber: 205 }]);
        }
        if (selectCall === 7) {
          return chain([
            {
              id: "bid-2",
              amount: "500.00",
              placedVia: "saleroom",
              isAutoBid: false,
              createdAt: new Date("2026-06-17T15:00:00.000Z"),
            },
            {
              id: "bid-1",
              amount: "475.00",
              placedVia: "web",
              isAutoBid: false,
              createdAt: new Date("2026-06-17T14:55:00.000Z"),
            },
          ]);
        }
        if (selectCall === 8) {
          return chain([
            {
              id: "lot-1",
              lotNumber: 1,
              title: "Meridian Drift",
              images: ["img-key"],
              marketingDetails: {
                estimate: { low: "400.00", high: "600.00", currency: "GBP" },
              },
            },
            {
              id: "lot-2",
              lotNumber: 2,
              title: "Next piece",
              images: ["next-key"],
              marketingDetails: null,
            },
          ]);
        }
        return chain([]);
      }),
    };

    const resolve = vi
      .fn()
      .mockResolvedValueOnce("https://cdn/img.jpg")
      .mockResolvedValueOnce("https://cdn/next.jpg");

    const reader = new DisplaySnapshotReader({
      reader: new DrizzleSaleroomDisplaySnapshotReader(db as never),
      mediaUrlResolver: { resolve } as never,
    });

    const snap = await reader.getSnapshot("sale-1");
    expect(snap?.currentLot).toMatchObject({
      lotNumber: 1,
      title: "Meridian Drift",
      currentPrice: "500.00",
      bidCount: 2,
      minBidIncrement: "25.00",
      estimate: { low: "400.00", high: "600.00", currency: "GBP" },
    });
    expect(snap?.currentLot?.recentBids).toEqual([
      {
        id: "bid-2",
        amount: "500.00",
        placedVia: "saleroom",
        isAutoBid: false,
        at: "2026-06-17T15:00:00.000Z",
      },
      {
        id: "bid-1",
        amount: "475.00",
        placedVia: "web",
        isAutoBid: false,
        at: "2026-06-17T14:55:00.000Z",
      },
    ]);
    expect(snap?.currentLot).not.toHaveProperty("reserveMet");
    expect(snap?.saleProgress).toEqual({ position: 1, total: 2 });
    expect(snap?.nextLot).toMatchObject({
      lotNumber: 2,
      title: "Next piece",
      imageUrl: "https://cdn/next.jpg",
    });
    expect(snap?.saleCoverImageUrl).toBeNull();
    expect(snap?.sessionStartedAt).toBe("2026-06-17T14:00:00.000Z");
  });

  it("returns null next lot on last lot in catalog", async () => {
    let selectCall = 0;
    const db = {
      select: vi.fn(() => {
        selectCall += 1;
        if (selectCall === 1) {
          return chain([
            { id: "sale-1", title: "Hybrid sale", deliveryMode: "hybrid", coverImages: [] },
          ]);
        }
        if (selectCall === 2) {
          return chain([
            {
              status: "live",
              currentLotId: "lot-2",
              displayOverlay: null,
              startedAt: new Date("2026-06-17T14:00:00.000Z"),
            },
          ]);
        }
        if (selectCall === 3) {
          return chain([
            {
              id: "lot-2",
              lotNumber: 2,
              title: "Final lot",
              images: [],
              currentPrice: "900.00",
              marketingDetails: null,
              minBidIncrement: "50.00",
            },
          ]);
        }
        if (selectCall === 4) return chain([{ count: 0 }]);
        if (selectCall === 5) return chain([]);
        if (selectCall === 6) return chain([]);
        if (selectCall === 7) {
          return chain([
            { id: "lot-1", lotNumber: 1, title: "First", images: [], marketingDetails: null },
            { id: "lot-2", lotNumber: 2, title: "Final lot", images: [], marketingDetails: null },
          ]);
        }
        return chain([]);
      }),
    };

    const reader = new DisplaySnapshotReader({
      reader: new DrizzleSaleroomDisplaySnapshotReader(db as never),
      mediaUrlResolver: { resolve: vi.fn().mockResolvedValue(null) } as never,
    });

    const snap = await reader.getSnapshot("sale-1");
    expect(snap?.saleProgress).toEqual({ position: 2, total: 2 });
    expect(snap?.nextLot).toBeNull();
    expect(snap?.currentLot?.estimate).toBeNull();
  });

  it("resolves cover image when between lots and skips catalog query when not live", async () => {
    let selectCall = 0;
    const db = {
      select: vi.fn(() => {
        selectCall += 1;
        if (selectCall === 1) {
          return chain([
            {
              id: "sale-1",
              title: "Hybrid sale",
              deliveryMode: "hybrid",
              coverImages: ["cover-key"],
            },
          ]);
        }
        if (selectCall === 2) {
          return chain([
            {
              status: "pending",
              currentLotId: null,
              displayOverlay: null,
              startedAt: null,
            },
          ]);
        }
        return chain([]);
      }),
    };

    const resolve = vi.fn().mockResolvedValue("https://cdn/cover.jpg");
    const reader = new DisplaySnapshotReader({
      reader: new DrizzleSaleroomDisplaySnapshotReader(db as never),
      mediaUrlResolver: { resolve } as never,
    });

    const snap = await reader.getSnapshot("sale-1");
    expect(snap?.saleCoverImageUrl).toBe("https://cdn/cover.jpg");
    expect(snap?.saleProgress).toBeNull();
    expect(snap?.nextLot).toBeNull();
    expect(selectCall).toBe(2);
  });
});
