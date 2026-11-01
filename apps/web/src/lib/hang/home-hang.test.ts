import { describe, expect, it } from "vitest";
import { hangLot, hangSale } from "./hang-fixtures";
import {
  type HangSale,
  type HomeHangState,
  buildHomeHang,
  hangKind,
  hangSaleIds,
  planHomeHang,
} from "./home-hang";

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

const state = (over: Partial<HomeHangState> = {}): HomeHangState => ({
  state: "live",
  leadSaleId: "sale-1",
  resultsBandSaleIds: [],
  ...over,
});

const SOLD = { status: "ended" as const, winnerId: "u1" };

describe("hangKind", () => {
  it.each([
    ["live", "inSale"],
    ["upcoming", "inSale"],
    ["justEnded", "recentlySold"],
    ["recentResults", "recentlySold"],
    ["betweenSeasons", "recentlySold"],
  ] as const)("titles the %s state as %s", (s, kind) => {
    expect(hangKind(s)).toBe(kind);
  });
});

describe("hangSaleIds", () => {
  it("reads the lead sale for every state but between seasons", () => {
    expect(hangSaleIds(state({ state: "upcoming", leadSaleId: "x" }))).toEqual(["x"]);
    expect(hangSaleIds(state({ leadSaleId: null }))).toEqual([]);
  });

  it("reads the last two ended sales between seasons", () => {
    expect(
      hangSaleIds(state({ state: "betweenSeasons", resultsBandSaleIds: ["a", "b", "c"] })),
    ).toEqual(["a", "b"]);
  });
});

describe("in this sale", () => {
  it("titles a live sale's wall In this sale and offers all its lots", () => {
    const entry = saleWith(8);
    const plan = planHomeHang(state(), [entry]);
    const hang = buildHomeHang(plan, plan?.candidates ?? [], NOW);
    expect(hang).toMatchObject({
      kind: "inSale",
      title: "In this sale",
      summary: "8 lots",
      scaleNote: true,
      seeAll: { label: "See all 8 lots" },
    });
    expect(hang?.works).toHaveLength(8);
  });

  it("offers a preview of an upcoming sale", () => {
    const entry = saleWith(6, { status: "scheduled" }, { status: "scheduled" });
    const plan = planHomeHang(state({ state: "upcoming" }), [entry]);
    const hang = buildHomeHang(plan, plan?.candidates ?? [], NOW);
    expect(hang?.title).toBe("In this sale");
    expect(hang?.seeAll.label).toBe("Preview all 6 lots");
  });

  it("leads with the lead sale's featured lots in staff order, then its top lots", () => {
    const entry = saleWith(5, { featuredLotIds: ["sale-1-l2", "sale-1-l4"] });
    expect(planHomeHang(state(), [entry])?.candidates.map((l) => l.id)).toEqual([
      "sale-1-l2",
      "sale-1-l4",
    ]);
    const plain = saleWith(5);
    expect(planHomeHang(state(), [plain])?.candidates[0]?.id).toBe("sale-1-l5");
  });

  it("says how many of the sale's lots are shown when it shows only some", () => {
    const entry = { ...saleWith(4), lotCount: 30 };
    const plan = planHomeHang(state(), [entry]);
    expect(buildHomeHang(plan, plan?.candidates ?? [], NOW)?.summary).toBe("4 of 30 lots");
  });

  it("is left out with fewer than two works with photographs hanging", () => {
    const entry = saleWith(3);
    const plan = planHomeHang(state(), [entry]);
    expect(buildHomeHang(plan, plan?.candidates.slice(0, 1) ?? [], NOW)).toBeNull();
    expect(buildHomeHang(plan, [], NOW)).toBeNull();
  });

  it("hangs only the lots the page allocated to it", () => {
    const entry = saleWith(5);
    const plan = planHomeHang(state(), [entry]);
    const hang = buildHomeHang(plan, plan?.candidates.slice(0, 3) ?? [], NOW);
    expect(hang?.works).toHaveLength(3);
    expect(hang?.summary).toBe("3 of 5 lots");
  });

  it("has nothing when the lead sale was not loaded", () => {
    expect(planHomeHang(state(), [])).toBeNull();
    expect(buildHomeHang(null, [], NOW)).toBeNull();
  });
});

describe("recently sold", () => {
  it.each(["justEnded", "recentResults"] as const)(
    "shows the lead sale's sold lots in the %s state with a link to its results",
    (name) => {
      const entry = saleWith(
        4,
        { id: "sep", title: "September Modern British", status: "ended" },
        SOLD,
      );
      const plan = planHomeHang(state({ state: name, leadSaleId: "sep" }), [entry]);
      const hang = buildHomeHang(plan, plan?.candidates ?? [], NOW);
      expect(hang).toMatchObject({
        kind: "recentlySold",
        title: "Recently sold",
        scaleNote: false,
        seeAll: { label: "See the results" },
      });
      expect(hang?.summary).toContain("September Modern British · 4 lots sold");
      expect(hang?.summary).toContain("buyer’s premium");
      expect(hang?.works[0]?.label.eyebrow).toMatch(/^Lot /);
    },
  );

  it("mixes the last two sales between seasons and names each work's sale", () => {
    const sep = saleWith(
      2,
      { id: "sep", title: "September Modern British", status: "ended" },
      SOLD,
    );
    const oct = saleWith(2, { id: "oct", title: "Autumn Works on Paper", status: "ended" }, SOLD);
    const plan = planHomeHang(
      state({ state: "betweenSeasons", leadSaleId: "oct", resultsBandSaleIds: ["oct", "sep"] }),
      [sep, oct],
    );
    const hang = buildHomeHang(plan, plan?.candidates ?? [], NOW);
    expect(hang?.summary).toBe("From the last two sales · prices include buyer’s premium");
    expect(hang?.seeAll).toMatchObject({ href: "/archive", label: "All results" });
    const eyebrows = hang?.works.map((w) => w.label.eyebrow);
    expect(eyebrows).toContain("September Modern British");
    expect(eyebrows).toContain("Autumn Works on Paper");
  });

  it("leaves out lots that did not sell", () => {
    const entry = saleWith(3, { id: "x", status: "ended" }, { status: "ended", winnerId: null });
    expect(planHomeHang(state({ state: "recentResults", leadSaleId: "x" }), [entry])).toBeNull();
  });
});
