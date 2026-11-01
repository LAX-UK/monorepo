import { describe, expect, it } from "vitest";
import { hangLot, hangSale } from "./hang-fixtures";
import { type HangSale, homeHangLotIds, pickCurrentSale, resolveHomeHang } from "./home-hang";

const NOW = new Date("2026-11-01T12:00:00.000Z");

function saleWith(count: number, saleOverrides = {}, lotOverrides = {}): HangSale {
  const sale = hangSale(saleOverrides);
  const lots = Array.from({ length: count }, (_, i) =>
    hangLot({
      id: `${sale.id}-l${i + 1}`,
      saleId: sale.id,
      lotNumber: i + 1,
      title: `Work ${i + 1}`,
      currentPrice: String(1000 + i * 100),
      ...lotOverrides,
    }),
  );
  return { sale, lots, lotCount: count };
}

describe("pickCurrentSale", () => {
  it("prefers the live sale, then the next to open", () => {
    const upcoming = { sale: hangSale({ id: "u", status: "scheduled" }) };
    const live = { sale: hangSale({ id: "l", status: "active" }) };
    expect(pickCurrentSale([upcoming, live])?.sale.id).toBe("l");
    expect(pickCurrentSale([upcoming])?.sale.id).toBe("u");
    expect(pickCurrentSale([])).toBeNull();
  });
});

describe("resolveHomeHang: in this sale", () => {
  it("titles a live sale's wall In this sale and offers all its lots", () => {
    const hang = resolveHomeHang({ openSales: [saleWith(8)], endedSales: [], now: NOW });
    expect(hang).toMatchObject({
      kind: "inSale",
      title: "In this sale",
      summary: "8 lots",
      scaleNote: true,
      seeAll: { href: expect.stringContaining("sale"), label: "See all 8 lots" },
    });
    expect(hang?.works).toHaveLength(8);
  });

  it("offers a preview of an upcoming sale", () => {
    const hang = resolveHomeHang({
      openSales: [saleWith(6, { status: "scheduled" }, { status: "scheduled" })],
      endedSales: [],
      now: NOW,
    });
    expect(hang?.title).toBe("In this sale");
    expect(hang?.seeAll.label).toBe("Preview all 6 lots");
  });

  it("says how many of the sale's lots are shown when it shows only some", () => {
    const entry = { ...saleWith(4), lotCount: 30 };
    const hang = resolveHomeHang({ openSales: [entry], endedSales: [], now: NOW });
    expect(hang?.summary).toBe("4 of 30 lots");
  });

  it("is left out with fewer than two works with photographs", () => {
    const entry = saleWith(3);
    entry.lots = entry.lots.map((l, i) => (i === 0 ? l : { ...l, images: [], imageAssets: [] }));
    expect(resolveHomeHang({ openSales: [entry], endedSales: [], now: NOW })).toBeNull();
  });

  it("wins over recent results while a sale is live or upcoming", () => {
    const hang = resolveHomeHang({
      openSales: [saleWith(3)],
      endedSales: [saleWith(3, { id: "old", status: "ended" }, { status: "ended", winnerId: "u" })],
      now: NOW,
    });
    expect(hang?.kind).toBe("inSale");
  });
});

describe("resolveHomeHang: recently sold", () => {
  const sold = { status: "ended" as const, winnerId: "u1" };

  it("shows a single ended sale's sold lots with a link to its results", () => {
    const hang = resolveHomeHang({
      openSales: [],
      endedSales: [
        saleWith(4, { id: "sep", title: "September Modern British", status: "ended" }, sold),
      ],
      now: NOW,
    });
    expect(hang).toMatchObject({
      kind: "recentlySold",
      title: "Recently sold",
      scaleNote: false,
      seeAll: { label: "See the results" },
    });
    expect(hang?.summary).toContain("September Modern British · 4 lots sold");
    expect(hang?.summary).toContain("buyer’s premium");
    expect(hang?.works[0]?.label.eyebrow).toMatch(/^Lot /);
  });

  it("mixes the last two sales and names each work's sale", () => {
    const sep = saleWith(
      2,
      { id: "sep", title: "September Modern British", status: "ended" },
      sold,
    );
    const oct = saleWith(2, { id: "oct", title: "Autumn Works on Paper", status: "ended" }, sold);
    const hang = resolveHomeHang({ openSales: [], endedSales: [oct, sep], now: NOW });
    expect(hang?.summary).toBe("From the last two sales · prices include buyer’s premium");
    expect(hang?.seeAll).toMatchObject({ href: "/archive", label: "All results" });
    const eyebrows = hang?.works.map((w) => w.label.eyebrow);
    expect(eyebrows).toContain("September Modern British");
    expect(eyebrows).toContain("Autumn Works on Paper");
  });

  it("leaves out lots that did not sell", () => {
    const entry = saleWith(3, { status: "ended" }, { status: "ended", winnerId: null });
    expect(resolveHomeHang({ openSales: [], endedSales: [entry], now: NOW })).toBeNull();
  });

  it("is left out with nothing to show", () => {
    expect(resolveHomeHang({ openSales: [], endedSales: [], now: NOW })).toBeNull();
  });
});

describe("homeHangLotIds", () => {
  it("lists the hung lots so More lots can skip them", () => {
    const hang = resolveHomeHang({ openSales: [saleWith(3)], endedSales: [], now: NOW });
    expect(homeHangLotIds(hang)).toEqual(new Set(["sale-1-l1", "sale-1-l2", "sale-1-l3"]));
    expect(homeHangLotIds(null).size).toBe(0);
  });
});
