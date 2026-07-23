import { describe, expect, it } from "vitest";
import { toAdminLotTableRow } from "./admin-lots.vm";

describe("toAdminLotTableRow", () => {
  it("maps thumbnail, lot number, estimate, and sale title", () => {
    const row = toAdminLotTableRow(
      {
        id: "lot-1",
        title: "Blue vase",
        lotNumber: 12,
        images: ["https://cdn.example/vase.jpg"],
        saleId: "sale-1",
        auctionType: "english",
        status: "active",
        endTime: new Date("2026-06-01T12:00:00Z"),
        currentPrice: "500.00",
        marketingDetails: {
          estimate: { low: "400", high: "600", currency: "GBP" },
        },
      } as never,
      {
        saleContextById: new Map([
          [
            "sale-1",
            { title: "Modern Sale", status: "active" as const, deliveryMode: "online" as const },
          ],
        ]),
      },
    );

    expect(row.lotNumber).toBe(12);
    expect(row.thumbnailUrl).toBe("https://cdn.example/vase.jpg");
    expect(row.imageCount).toBe(1);
    expect(row.estimateDisplay.primary).toMatch(/400.*600/);
    expect(row.hammerDisplay.primary).toMatch(/£500/);
    expect(row.saleTitle).toBe("Modern Sale");
    expect(row.saleStatus).toBe("active");
    expect(row.saleDeliveryMode).toBe("online");
  });

  it("maps artist label and zero photos", () => {
    const row = toAdminLotTableRow(
      {
        id: "lot-2",
        title: "Untitled",
        lotNumber: 3,
        images: [],
        artistId: "artist-1",
        auctionType: "english",
        status: "draft",
        endTime: new Date("2026-06-01T12:00:00Z"),
        currentPrice: "0.00",
      } as never,
      { artistNameById: new Map([["artist-1", "Jane Doe"]]) },
    );

    expect(row.imageCount).toBe(0);
    expect(row.artistLabel).toBe("Jane Doe");
  });
});
