import type { SaleListRow } from "@/lib/data/http/sales.server";
import { countSaleFacets } from "@/lib/marketing/sales-calendar-facets";
import { describe, expect, it } from "vitest";

function row(input: {
  id: string;
  deliveryMode: "online" | "onsite";
  city?: string | null;
  start: string;
  categoryIds?: string[];
}): SaleListRow {
  return {
    sale: {
      id: input.id,
      deliveryMode: input.deliveryMode,
      locationCity: input.city ?? null,
      startTime: input.start,
      categoryId: null,
      categoryIds: input.categoryIds ?? [],
    },
    lots: [],
    lotCount: 0,
  } as unknown as SaleListRow;
}

const rows = [
  row({ id: "a", deliveryMode: "online", start: "2026-11-10T12:00:00Z", categoryIds: ["art"] }),
  row({
    id: "b",
    deliveryMode: "online",
    start: "2026-12-02T12:00:00Z",
    categoryIds: ["art", "ceramics"],
  }),
  row({
    id: "c",
    deliveryMode: "onsite",
    city: "London",
    start: "2026-11-20T12:00:00Z",
    categoryIds: ["ceramics"],
  }),
];

describe("countSaleFacets", () => {
  it("counts every option over all the sales when nothing is applied", () => {
    const counts = countSaleFacets(rows, {});
    expect(counts.delivery).toEqual({ online: 2, onsite: 1 });
    expect(counts.location).toEqual({ online: 2, london: 1 });
    expect(counts.months).toEqual({ 11: 2, 12: 1 });
    expect(counts.years).toEqual({ 2026: 3 });
    expect(counts.departments).toEqual({ art: 2, ceramics: 2 });
  });

  it("counts a sale in every department it belongs to", () => {
    expect(countSaleFacets(rows, {}).departments.ceramics).toBe(2);
  });

  it("applies the other filters but not the group's own", () => {
    const counts = countSaleFacets(rows, { deliveryMode: "online", month: 11 });
    // Delivery ignores its own filter: November has one online and one in-person sale.
    expect(counts.delivery).toEqual({ online: 1, onsite: 1 });
    // Month ignores its own filter: the online sales fall in November and December.
    expect(counts.months).toEqual({ 11: 1, 12: 1 });
    // Years keep both filters: one online sale in November.
    expect(counts.years).toEqual({ 2026: 1 });
  });

  it("counts departments across every department while one is chosen", () => {
    const counts = countSaleFacets(rows, { categoryId: "art" });
    expect(counts.departments).toEqual({ art: 2, ceramics: 2 });
    // Other groups stay inside the chosen department.
    expect(counts.delivery).toEqual({ online: 2, onsite: 0 });
  });
});
