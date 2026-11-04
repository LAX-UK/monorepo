import { countSaleroomStatuses } from "@/lib/marketing/saleroom-status-counts";
import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";

function lot(id: string, status: string, title = `Lot ${id}`): Lot {
  return { id, status, title } as unknown as Lot;
}

const lots = [
  lot("1", "active", "Blue vase"),
  lot("2", "scheduled", "Blue print"),
  lot("3", "scheduled", "Red chair"),
  lot("4", "ended", "Blue chair"),
  lot("4", "ended", "Blue chair"),
];

describe("countSaleroomStatuses", () => {
  it("counts each status once per lot", () => {
    expect(countSaleroomStatuses(lots, { catalogSearch: "", holdsWholeCatalogue: true })).toEqual({
      live: 1,
      upcoming: 2,
      ended: 1,
    });
  });

  it("keeps the search but not the status, so each option shows what it would give", () => {
    expect(
      countSaleroomStatuses(lots, { catalogSearch: "blue", holdsWholeCatalogue: true }),
    ).toEqual({ live: 1, upcoming: 1, ended: 1 });
  });

  it("gives no counts when the page holds only part of the sale", () => {
    expect(
      countSaleroomStatuses(lots, { catalogSearch: "", holdsWholeCatalogue: false }),
    ).toBeNull();
  });
});
