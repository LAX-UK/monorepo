import {
  RESULTS_SORT_LABEL,
  buildResultsRows,
  pickResultsCovers,
  resultsYears,
} from "@/lib/marketing/results-page.vm";
import type { SaleListRow } from "@/lib/sale-list-row";
import type { SaleResultsSummary } from "@auction/domain";
import type { Lot, Sale } from "@auction/types";
import { describe, expect, it } from "vitest";

const NOW = new Date("2026-11-01T12:00:00Z");

function sale(id: string, title: string, endTime: string, overrides: Partial<Sale> = {}): Sale {
  return {
    id,
    title,
    status: "ended",
    deliveryMode: "online",
    coverImages: [],
    startTime: new Date("2026-09-01T10:00:00Z"),
    endTime: new Date(endTime),
    ...overrides,
  } as Sale;
}

function lot(id: string, image: string | null, sold: boolean): Lot {
  return {
    id,
    title: `Work ${id}`,
    status: "ended",
    winnerId: sold ? "u1" : null,
    images: image ? [image] : [],
  } as Lot;
}

const final = (overrides: Partial<Extract<SaleResultsSummary, { state: "final" }>> = {}) =>
  ({
    state: "final",
    lotCount: 24,
    soldCount: 18,
    currency: "GBP",
    totalWithPremium: "186400.00",
    topLot: { lotId: "l2", priceWithPremium: "42000.00" },
    endedAt: "2026-10-15T20:00:00Z",
    ...overrides,
  }) satisfies SaleResultsSummary;

function row(
  s: Sale,
  resultsSummary: SaleResultsSummary | null,
  lots: Lot[] = [],
  lotCount = 24,
): SaleListRow {
  return { sale: s, lots, lotCount, resultsSummary };
}

describe("buildResultsRows", () => {
  it("shows sold of total and the total with premium for a final sale", () => {
    const [vm] = buildResultsRows(
      [row(sale("s1", "September Modern British", "2026-10-15T20:00:00Z"), final())],
      NOW,
    );
    expect(vm?.figures).toEqual({ state: "final", sold: "18 of 24", total: "£186,400" });
    expect(vm?.actionLabel).toBe("See results");
    expect(vm?.endedLabel).toBe("Ended Thu 15 Oct · online");
    expect(vm?.title).toBe("September Modern British");
  });

  it("marks a finalising sale with no figures and a link to the sale", () => {
    const [vm] = buildResultsRows(
      [
        row(sale("s2", "Modern and contemporary", "2026-11-01T09:00:00Z"), {
          state: "finalising",
          pendingLotCount: 3,
        }),
      ],
      NOW,
    );
    expect(vm?.figures).toEqual({ state: "finalising" });
    expect(vm?.actionLabel).toBe("View the sale");
  });

  it("hides sales with no lots and sales without a results summary", () => {
    const rows = buildResultsRows(
      [
        row(
          sale("s1", "Empty", "2026-10-15T20:00:00Z"),
          final({ lotCount: 0, soldCount: 0 }),
          [],
          0,
        ),
        row(sale("s2", "No summary", "2026-10-14T20:00:00Z"), null),
        row(sale("s3", "Real", "2026-10-13T20:00:00Z"), final()),
      ],
      NOW,
    );
    expect(rows.map((r) => r.title)).toEqual(["Real"]);
  });

  it("shows no total when nothing sold, so there is no bare zero", () => {
    const [vm] = buildResultsRows(
      [
        row(
          sale("s1", "Quiet sale", "2026-10-15T20:00:00Z"),
          final({ soldCount: 0, totalWithPremium: "0.00", topLot: null }),
        ),
      ],
      NOW,
    );
    expect(vm?.figures).toEqual({ state: "final", sold: "0 of 24", total: null });
  });

  it("orders newest close first, whatever order the list arrives in", () => {
    const rows = buildResultsRows(
      [
        row(sale("a", "Older", "2026-09-24T20:00:00Z"), final({ endedAt: "2026-09-24T20:00:00Z" })),
        row(sale("b", "Newest", "2026-11-01T09:00:00Z"), {
          state: "finalising",
          pendingLotCount: 1,
        }),
        row(sale("c", "Middle", "2026-10-15T20:00:00Z"), final()),
      ],
      NOW,
    );
    expect(rows.map((r) => r.title)).toEqual(["Newest", "Middle", "Older"]);
    expect(RESULTS_SORT_LABEL).toBe("Newest first");
  });
});

describe("pickResultsCovers", () => {
  it("leads with the top lot, then other sold works, and skips lots without an image", () => {
    const covers = pickResultsCovers(
      row(
        sale("s1", "Sale", "2026-10-15T20:00:00Z"),
        final({ topLot: { lotId: "l3", priceWithPremium: "9000" } }),
        [
          lot("l1", "/a.jpg", false),
          lot("l2", null, true),
          lot("l3", "/c.jpg", true),
          lot("l4", "/d.jpg", true),
        ],
      ),
    );
    expect(covers.map((c) => c.url)).toEqual(["/c.jpg", "/d.jpg"]);
  });

  it("gives no cover when no lot has an image", () => {
    expect(
      pickResultsCovers(
        row(sale("s1", "Sale", "2026-10-15T20:00:00Z"), final(), [lot("l1", null, true)]),
      ),
    ).toEqual([]);
  });
});

describe("resultsYears", () => {
  it("lists only years with a sale that has results, newest first", () => {
    const years = resultsYears([
      row(sale("a", "A", "2026-10-15T20:00:00Z"), final()),
      row(sale("b", "B", "2025-03-01T20:00:00Z"), final({ endedAt: "2025-03-01T20:00:00Z" })),
      row(sale("c", "Empty 2024", "2024-03-01T20:00:00Z"), final(), [], 0),
      row(sale("d", "No summary 2023", "2023-03-01T20:00:00Z"), null),
    ]);
    expect(years).toEqual([2026, 2025]);
  });
});
