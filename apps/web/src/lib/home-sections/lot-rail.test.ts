import { hangLot, hangSale } from "@/lib/hang/hang-fixtures";
import { buildLotRail } from "@/lib/home-sections/lot-rail";
import { describe, expect, it } from "vitest";

const now = new Date("2026-11-02T12:00:00.000Z");
const lots = (n: number) =>
  Array.from({ length: n }, (_, i) => hangLot({ id: `l${i}`, lotNumber: i + 1 }));
const base = { sale: hangSale(), lotCount: 12, artistNames: {}, now };

describe("buildLotRail", () => {
  it("is hidden below four lots, so a row is never mostly empty", () => {
    expect(buildLotRail({ ...base, kind: "inThisSale", lots: lots(3) })).toBeNull();
    expect(buildLotRail({ ...base, kind: "inThisSale", lots: lots(4) })).not.toBeNull();
  });

  it("says when bidding closes for a live sale and links to all its lots", () => {
    const rail = buildLotRail({ ...base, kind: "inThisSale", lots: lots(4) });
    expect(rail?.heading).toBe("More from this sale");
    expect(rail?.subtitle).toBe("Bidding closes from 3 Nov 2026, 21:00 GMT");
    expect(rail?.seeAll.label).toBe("View all 12 lots");
  });

  it("says when bidding opens for the next sale", () => {
    const sale = hangSale({ status: "scheduled", startTime: new Date("2026-11-10T18:00:00.000Z") });
    const rail = buildLotRail({ ...base, sale, kind: "highlightsFromNextSale", lots: lots(4) });
    expect(rail?.heading).toBe("Highlights from the next sale");
    expect(rail?.subtitle).toBe("Estimates shown; bidding opens 10 Nov 2026, 18:00 GMT");
  });

  it("names the results of an ended sale and states that prices include premium", () => {
    const sold = lots(4).map((lot) => ({ ...lot, status: "ended" as const, winnerId: "u" }));
    const rail = buildLotRail({ ...base, kind: "topLotsOfSale", lots: sold });
    expect(rail?.subtitle).toBe("Prices include buyer’s premium");
    expect(rail?.seeAll.label).toBe("All 12 results");
    expect(rail?.lots[0]?.price?.qualifier).toBe("Sold for");
  });

  it("counts at least the lots it shows", () => {
    const rail = buildLotRail({ ...base, lotCount: 0, kind: "inThisSale", lots: lots(5) });
    expect(rail?.seeAll.label).toBe("View all 5 lots");
  });

  it("offers the watch toggle only on lots that can still be followed", () => {
    const states = (["active", "scheduled", "ended", "cancelled"] as const).map(
      (status) =>
        buildLotRail({
          ...base,
          kind: "inThisSale",
          lots: [...lots(3), hangLot({ id: "x", lotNumber: 9, status })],
        })?.lots.find((lot) => lot.id === "x")?.watchable,
    );
    expect(states).toEqual([true, true, false, false]);
  });
});
