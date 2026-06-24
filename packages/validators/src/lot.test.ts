import { describe, expect, it } from "vitest";
import { createLotSchema } from "./lot.js";

const base = {
  title: "Test lot",
  categoryIds: ["11111111-1111-4111-8111-111111111111"],
  auctionType: "english" as const,
  startingPrice: "100.00",
  startTime: new Date("2026-07-01T12:00:00.000Z"),
  endTime: new Date("2026-07-02T12:00:00.000Z"),
  saleId: "22222222-2222-4222-8222-222222222222",
};

describe("createLotSchema reserve pricing", () => {
  it("rejects reserve below starting price", () => {
    const result = createLotSchema.safeParse({
      ...base,
      reservePrice: "50.00",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("reservePrice"))).toBe(true);
    }
  });

  it("accepts reserve at or above starting price", () => {
    const result = createLotSchema.safeParse({
      ...base,
      reservePrice: "100.00",
    });
    expect(result.success).toBe(true);
  });

  it("requires buy now price for buy_it_now type", () => {
    const result = createLotSchema.safeParse({
      ...base,
      auctionType: "buy_it_now",
    });
    expect(result.success).toBe(false);
  });

  it("rejects buy now below reserve", () => {
    const result = createLotSchema.safeParse({
      ...base,
      auctionType: "buy_it_now",
      reservePrice: "500.00",
      buyNowPrice: "400.00",
    });
    expect(result.success).toBe(false);
  });
});
