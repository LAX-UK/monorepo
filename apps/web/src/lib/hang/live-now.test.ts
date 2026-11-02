import { describe, expect, it } from "vitest";
import { hangLot, hangSale } from "./hang-fixtures";
import type { HangSale } from "./home-hang";
import { ALL_LIVE_SALES_LINK, buildLiveNow, liveTabLabel } from "./live-now";

const NOW = new Date("2026-11-01T12:00:00.000Z");
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function liveSale(id: string, closesInMs: number, lots = 3): HangSale {
  const sale = hangSale({
    id,
    title: `Sale ${id}`,
    status: "active",
    startTime: new Date(NOW.getTime() - 86_400_000),
    endTime: new Date(NOW.getTime() + closesInMs),
  });
  return {
    sale,
    lotCount: lots,
    lots: Array.from({ length: lots }, (_, i) =>
      hangLot({ id: `${id}-l${i}`, saleId: id, lotNumber: i + 1, title: `Work ${i}` }),
    ),
  };
}

const DAY = 86_400_000;
const state = (liveSaleIds: string[], leadSaleId: string) => ({ liveSaleIds, leadSaleId });

function build(sales: HangSale[], lead: string, hero: string[] = []) {
  const ids = sales
    .map((s) => s.sale)
    .sort((a, b) => a.endTime.getTime() - b.endTime.getTime())
    .map((s) => s.id);
  return buildLiveNow(state(ids, lead), sales, fakeHang(lead), new Set(hero), NOW);
}

function fakeHang(saleId: string) {
  return {
    kind: "inSale" as const,
    title: "In this sale",
    summary: "3 lots",
    scaleNote: true,
    seeAll: { href: `/sales/${saleId}`, label: "See all 3 lots" },
    works: [],
  };
}

describe("buildLiveNow", () => {
  it("is absent with one live sale, so the page keeps its single hang", () => {
    expect(
      buildLiveNow(state(["a"], "a"), [liveSale("a", DAY)], fakeHang("a"), new Set(), NOW),
    ).toBeNull();
  });

  it("makes a tab per live sale, soonest close first, opening on the lead", () => {
    const vm = build([liveSale("b", 2 * DAY), liveSale("a", DAY)], "b");
    expect(vm?.tabs.map((tab) => tab.saleId)).toEqual(["a", "b"]);
    expect(vm?.defaultSaleId).toBe("b");
    expect(vm?.allLive).toEqual(ALL_LIVE_SALES_LINK);
    expect(ALL_LIVE_SALES_LINK.href).toBe("/sales?tab=live");
  });

  it("caps the tabs at three and keeps the lead among them", () => {
    const sales = [
      liveSale("a", DAY),
      liveSale("b", 2 * DAY),
      liveSale("c", 3 * DAY),
      liveSale("d", 4 * DAY),
    ];
    expect(build(sales, "a")?.tabs.map((t) => t.saleId)).toEqual(["a", "b", "c"]);
    expect(build(sales, "d")?.tabs.map((t) => t.saleId)).toEqual(["a", "b", "d"]);
  });

  it("leaves out works the cover already shows", () => {
    const vm = build([liveSale("a", DAY), liveSale("b", 2 * DAY)], "a", ["b-l0", "b-l1", "b-l2"]);
    expect(vm).toBeNull();
  });
});

describe("tab labels", () => {
  const label = (closesInMs: number) => {
    const vm = build([liveSale("a", closesInMs), liveSale("b", 30 * DAY)], "a");
    const tab = vm?.tabs[0];
    return tab ? liveTabLabel(tab) : null;
  };

  it("tells days and hours within a week and a date one millisecond beyond it", () => {
    expect(label(2 * DAY + 3 * 3_600_000)).toBe("Sale a · Closes in 2 days 3 hours");
    expect(label(WEEK_MS)).toBe("Sale a · Closes in 7 days");
    expect(label(WEEK_MS + 1)).toBe("Sale a · Closes Sun 8 Nov, 12:00 GMT");
  });
});
