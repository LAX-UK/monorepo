import type { Lot } from "@auction/types";
import { describe, expect, it } from "vitest";
import { draftLotRow, lotToRow } from "./sale-lot-rows-editor-helpers";
import {
  appendSaleLotRow,
  countUnsavedSaleLotRows,
  initialSaleLotRows,
  removeSaleLotRowByClientId,
  saleLotRowsEditorFlags,
  saveSaleLotRow,
  syncConfirmBodyForConflicts,
} from "./sale-lot-rows-editor-state.logic";

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

describe("useSaleLotRowsEditorState transitions", () => {
  it("initializes rows from server lots", () => {
    const rows = initialSaleLotRows([makeLot()], lotToRow);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.lotId).toBe("lot-1");
    expect(
      saleLotRowsEditorFlags({ readOnly: false, lotsCount: 1, rowsCount: 1 }).showFirstLotChoice,
    ).toBe(false);
  });

  it("shows first-lot choice when draft sale has no lots", () => {
    const rows = initialSaleLotRows([], lotToRow);
    const flags = saleLotRowsEditorFlags({ readOnly: false, lotsCount: 0, rowsCount: rows.length });
    expect(rows).toHaveLength(0);
    expect(flags.showFirstLotChoice).toBe(true);
    expect(flags.showAddLotActions).toBe(false);
  });

  it("adds draft rows and tracks unsaved count", () => {
    let rows = initialSaleLotRows([], lotToRow);
    rows = appendSaleLotRow(rows, draftLotRow("new"));
    expect(rows[0]?.source).toBe("new");
    expect(countUnsavedSaleLotRows(rows)).toBe(1);

    rows = appendSaleLotRow(rows, draftLotRow("existing"));
    expect(rows[1]?.source).toBe("existing");
    expect(countUnsavedSaleLotRows(rows)).toBe(2);
  });

  it("marks row saved and clears unsaved count", () => {
    let rows = appendSaleLotRow(initialSaleLotRows([], lotToRow), draftLotRow("new"));
    const row = rows[0];
    expect(row).toBeDefined();
    if (!row) return;
    const clientRowId = row.clientRowId;
    rows = saveSaleLotRow(rows, clientRowId, { ...row, lotId: "lot-new", title: "Saved" });
    expect(rows[0]?.lotId).toBe("lot-new");
    expect(countUnsavedSaleLotRows(rows)).toBe(0);
  });

  it("removes a row by client id", () => {
    let rows = appendSaleLotRow(initialSaleLotRows([], lotToRow), draftLotRow("new"));
    const clientRowId = rows[0]?.clientRowId as string;
    rows = removeSaleLotRowByClientId(rows, clientRowId);
    expect(rows).toHaveLength(0);
  });

  it("builds sync confirm copy for one or many conflicts", () => {
    expect(syncConfirmBodyForConflicts(1)).toContain("this lot");
    expect(syncConfirmBodyForConflicts(3)).toContain("3 lots");
  });
});
