import { describe, expect, it } from "vitest";
import { hangLot, hangSale } from "./hang-fixtures";
import { buildSaleHang } from "./sale-hang";

const NOW = new Date("2026-11-01T12:00:00.000Z");
const SOLD = { status: "ended" as const, winnerId: "u1" };

function lots(count: number, over = {}) {
  return Array.from({ length: count }, (_, i) =>
    hangLot({
      id: `l${i + 1}`,
      lotNumber: i + 1,
      title: `Work ${i + 1}`,
      currentPrice: String(1000 + i * 100),
      ...over,
    }),
  );
}

const build = (
  l: ReturnType<typeof lots>,
  status: "active" | "scheduled" | "ended" | "cancelled" = "active",
  saleOver = {},
  lotCount = l.length,
) => buildSaleHang({ sale: hangSale(saleOver), lots: l, lotCount, status, now: NOW });

describe("buildSaleHang", () => {
  it("is Highlights for a live or upcoming sale, with the lots ranked by price", () => {
    for (const status of ["active", "scheduled"] as const) {
      const hang = build(lots(4), status);
      expect(hang?.title).toBe("Highlights");
      expect(hang?.summary).toBe("4 lots");
      expect(hang?.works.map((w) => w.lotId)).toEqual(["l4", "l3", "l2", "l1"]);
      expect(hang?.figure).toBe(false);
    }
  });

  it("leads with staff's featured lots in their order and says so", () => {
    const hang = build(lots(6), "active", { featuredLotIds: ["l5", "l2", "l3"] });
    expect(hang?.works.map((w) => w.lotId)).toEqual(["l5", "l2", "l3"]);
    expect(hang?.summary).toBe("3 featured lots");
  });

  it("counts the part of a larger sale it shows", () => {
    const hang = build(lots(3), "active", {}, 9);
    expect(hang?.summary).toBe("3 of 9 lots");
  });

  it("is Top lots with sold lots only once the sale has ended", () => {
    const l = [
      ...lots(3, SOLD),
      hangLot({ id: "unsold", status: "ended", winnerId: null, currentPrice: "9000.00" }),
    ];
    const hang = build(l, "ended", {}, 4);
    expect(hang?.title).toBe("Top lots");
    expect(hang?.works.map((w) => w.lotId)).toEqual(["l3", "l2", "l1"]);
    expect(hang?.summary).toBe("3 of 4 lots sold");
  });

  it("says all lots sold when they all did", () => {
    expect(build(lots(4, SOLD), "ended")?.summary).toBe("All 4 lots sold");
  });

  it("leaves out withdrawn lots and lots without a photograph", () => {
    const l = [
      ...lots(2),
      hangLot({ id: "w", status: "cancelled" }),
      hangLot({ id: "n", images: [], imageAssets: [] }),
    ];
    expect(
      build(l, "active", {}, 4)
        ?.works.map((w) => w.lotId)
        .sort(),
    ).toEqual(["l1", "l2"]);
  });

  it("is hidden with fewer than two works unless one real-sized work can hang with a figure", () => {
    expect(build([], "active", {}, 0)).toBeNull();
    const noPhotos = lots(3, { images: [], imageAssets: [] });
    expect(build(noPhotos)).toBeNull();
    const single = build(lots(1));
    expect(single?.figure).toBe(true);
    expect(single?.summary).toBe("1 lot");
    expect(build(lots(1, { dimensions: null }))).toBeNull();
  });

  it("is hidden for a cancelled sale and for an ended sale that sold nothing", () => {
    expect(build(lots(4), "cancelled")).toBeNull();
    expect(build(lots(3), "ended")).toBeNull();
    expect(build(lots(1, SOLD), "ended")?.figure).toBe(true);
  });
});
