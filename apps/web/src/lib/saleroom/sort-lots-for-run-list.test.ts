import {
  findNextRunListLot,
  formatLotRunListLabel,
  sortLotsForRunList,
} from "@/lib/saleroom/sort-lots-for-run-list";
import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";

function lot(id: string, lotNumber: number | null, title: string): Lot {
  return {
    id,
    lotNumber,
    title,
  } as Lot;
}

describe("sortLotsForRunList", () => {
  it("orders lots by lot number then title", () => {
    const ordered = sortLotsForRunList([lot("c", 12, "C"), lot("a", 2, "A"), lot("b", 10, "B")]);
    expect(ordered.map((l) => l.id)).toEqual(["a", "b", "c"]);
  });

  it("formats lot labels with number and title", () => {
    expect(formatLotRunListLabel(lot("x", 7, "Blue Vase"))).toBe("Lot 7 · Blue Vase");
  });

  it("finds the next lot after the current lot on block", () => {
    const lots = [lot("l1", 1, "One"), lot("l2", 2, "Two"), lot("l3", 3, "Three")];
    expect(findNextRunListLot(lots, "l1")?.id).toBe("l2");
    expect(findNextRunListLot(lots, "l3")).toBeNull();
  });
});
