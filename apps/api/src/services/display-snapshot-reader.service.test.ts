import { describe, expect, it, vi } from "vitest";
import { DisplaySnapshotReader } from "./display-snapshot-reader.service.js";

function chain(resolved: unknown[]) {
  const result = Promise.resolve(resolved);
  const limit = vi.fn().mockReturnValue(result);
  const whereResult = Object.assign(result, { limit });
  const where = vi.fn().mockReturnValue(whereResult);
  const from = vi.fn().mockReturnValue({ where, limit });
  return { from, where, limit };
}

describe("DisplaySnapshotReader", () => {
  it("returns null for non-saleroom delivery modes", async () => {
    const saleChain = chain([{ id: "sale-1", title: "Sale", deliveryMode: "online" }]);
    const db = { select: vi.fn().mockReturnValue(saleChain) };
    const reader = new DisplaySnapshotReader({
      db: db as never,
      mediaUrlResolver: { resolve: vi.fn() } as never,
    });

    const snap = await reader.getSnapshot("sale-1");
    expect(snap).toBeNull();
  });

  it("omits reserve status from current lot", async () => {
    let selectCall = 0;
    const db = {
      select: vi.fn(() => {
        selectCall += 1;
        if (selectCall === 1) {
          return chain([{ id: "sale-1", title: "Hybrid sale", deliveryMode: "hybrid" }]);
        }
        if (selectCall === 2) {
          return chain([{ status: "live", currentLotId: "lot-1", displayOverlay: null }]);
        }
        if (selectCall === 3) {
          return chain([
            {
              id: "lot-1",
              lotNumber: 3,
              title: "Meridian Drift",
              images: ["img-key"],
              currentPrice: "500.00",
            },
          ]);
        }
        if (selectCall === 4) {
          return chain([{ count: 2 }]);
        }
        if (selectCall === 5) {
          return chain([]);
        }
        return chain([]);
      }),
    };

    const reader = new DisplaySnapshotReader({
      db: db as never,
      mediaUrlResolver: { resolve: vi.fn().mockResolvedValue("https://cdn/img.jpg") } as never,
    });

    const snap = await reader.getSnapshot("sale-1");
    expect(snap?.currentLot).toMatchObject({
      lotNumber: 3,
      title: "Meridian Drift",
      currentPrice: "500.00",
      bidCount: 2,
    });
    expect(snap?.currentLot).not.toHaveProperty("reserveMet");
  });
});
