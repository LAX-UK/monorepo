import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { closingPattern, closingPatternText, lotsInClosingOrder } from "./sale-schedule-tab.vm";

function lot(id: string, endTime: string, lotNumber: number | null = null): Lot {
  return {
    id,
    lotNumber,
    title: id,
    startTime: new Date("2026-06-01T10:00:00.000Z"),
    endTime: new Date(endTime),
  } as Lot;
}

describe("sale-schedule-tab.vm", () => {
  it("puts lots in the order they close, then by lot number", () => {
    const ordered = lotsInClosingOrder([
      lot("c", "2026-06-02T10:04:00.000Z", 3),
      lot("a", "2026-06-02T10:00:00.000Z", 2),
      lot("b", "2026-06-02T10:00:00.000Z", 1),
    ]);

    expect(ordered.map((l) => l.id)).toEqual(["b", "a", "c"]);
  });

  it("reads no lots, one closing time and an even stagger", () => {
    expect(closingPatternText(closingPattern([]))).toBe("No lots are attached yet.");
    expect(
      closingPatternText(
        closingPattern([
          lot("a", "2026-06-02T10:00:00.000Z"),
          lot("b", "2026-06-02T10:00:00.000Z"),
        ]),
      ),
    ).toBe("All lots close together.");
    expect(
      closingPatternText(
        closingPattern([
          lot("a", "2026-06-02T10:00:00.000Z"),
          lot("b", "2026-06-02T10:02:00.000Z"),
          lot("c", "2026-06-02T10:04:00.000Z"),
        ]),
      ),
    ).toBe("Staggered: a lot closes every 2 minutes.");
  });

  it("says lots close at different times when the gaps are uneven", () => {
    expect(
      closingPatternText(
        closingPattern([
          lot("a", "2026-06-02T10:00:00.000Z"),
          lot("b", "2026-06-02T10:02:00.000Z"),
          lot("c", "2026-06-02T10:07:00.000Z"),
        ]),
      ),
    ).toBe("Staggered: lots close at different times.");
  });
});
