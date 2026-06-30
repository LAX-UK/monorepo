import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import {
  draftLotRow,
  lotToRow,
  saleLotRowsCountSaved,
  saleLotRowsHaveUnsaved,
} from "./sale-lot-rows-editor-helpers";

function makeLot(overrides: Partial<Lot> = {}): Lot {
  return {
    id: "lot-1",
    title: "Test lot",
    sellerLegalEntityId: "le-1",
    categoryIds: ["cat-1"],
    auctionType: "english",
    startingPrice: "100",
    artistId: null,
    startTime: new Date("2026-06-02T10:00:00Z"),
    endTime: new Date("2026-06-03T18:00:00Z"),
    saleId: "sale-1",
    lotNumber: 1,
    status: "draft",
    currentPrice: "100",
    images: [],
    marketingDetails: { estimate: null },
    sellerId: "seller-1",
    ...overrides,
  } as Lot;
}

describe("sale lot row helpers", () => {
  it("lotToRow maps server lot fields", () => {
    const row = lotToRow(makeLot({ title: "Vase" }));
    expect(row.lotId).toBe("lot-1");
    expect(row.title).toBe("Vase");
    expect(row.clientRowId).toBe("lot-1");
  });

  it("draftLotRow creates unsaved rows", () => {
    const row = draftLotRow("existing");
    expect(row.source).toBe("existing");
    expect(row.lotId).toBeUndefined();
    expect(saleLotRowsHaveUnsaved([row])).toBe(true);
    expect(saleLotRowsCountSaved([row])).toBe(0);
  });
});
