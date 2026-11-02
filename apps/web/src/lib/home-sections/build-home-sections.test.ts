import { hangLot, hangSale } from "@/lib/hang/hang-fixtures";
import {
  type HomeSectionsSource,
  buildHomeSections,
  visibleHomeSections,
} from "@/lib/home-sections/build-home-sections";
import { saleListRow } from "@/lib/sale-list-row";
import { resolveHomeState } from "@auction/domain";
import { describe, expect, it } from "vitest";

const now = new Date("2026-11-02T12:00:00.000Z");

function source(over: Partial<HomeSectionsSource> & { sales?: ReturnType<typeof hangSale>[] }) {
  const sales = over.sales ?? [];
  return {
    state: resolveHomeState({ sales, now }),
    now,
    rows: sales.map((sale) => saleListRow(sale, [], 8)),
    lotsBySale: new Map(),
    placed: { rail: [], results: [] },
    artistNames: {},
    categories: [],
    artists: [],
    press: [],
    ...over,
  } satisfies HomeSectionsSource;
}

describe("buildHomeSections", () => {
  it("with no data at all, between seasons keeps only the selling band", () => {
    const empty = source({});
    expect(empty.state.state).toBe("betweenSeasons");
    const sections = buildHomeSections(empty);
    expect(visibleHomeSections(empty.state, sections)).toEqual(["selling"]);
  });

  it("builds only the sections of the state, in the state's order", () => {
    const live = hangSale({ id: "live", status: "active" });
    const next = hangSale({
      id: "next",
      status: "scheduled",
      startTime: new Date("2026-11-10T18:00:00.000Z"),
    });
    const lots = [1, 2, 3].map((n) => hangLot({ id: `l${n}`, lotNumber: n }));
    const input = source({
      sales: [live, next],
      lotsBySale: new Map([["live", lots]]),
      placed: { rail: lots, results: [] },
    });
    const sections = buildHomeSections(input);
    expect(input.state.state).toBe("live");
    expect(visibleHomeSections(input.state, sections)).toEqual([
      "inThisSale",
      "comingUp",
      "selling",
      "alerts",
    ]);
    expect(sections.inThisSale?.lots).toHaveLength(3);
    expect(sections.topLotsOfSale).toBeUndefined();
  });

  it("always offers the alerts sign-up in a state that lists it", () => {
    const upcoming = source({
      sales: [
        hangSale({ id: "n", status: "scheduled", startTime: new Date("2026-11-10T18:00:00.000Z") }),
      ],
    });
    expect(buildHomeSections(upcoming).alerts).toBe(true);
  });
});
