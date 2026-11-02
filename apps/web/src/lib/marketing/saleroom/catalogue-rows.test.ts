import { describe, expect, it } from "vitest";
import { mergeCatalogueRows, toWithdrawnRowVM, withdrawnRowsFor } from "./catalogue-rows";

const lot = (id: string, lotNumber: number | null) => ({ id, lotNumber });
const withdrawn = (id: string, lotNumber: number | null, title = `Work ${id}`) => ({
  id,
  lotNumber,
  title,
});

const keys = (rows: ReturnType<typeof mergeCatalogueRows>) => rows.map((r) => `${r.kind}:${r.key}`);

describe("withdrawnRowsFor", () => {
  const rows = [withdrawn("w1", 3, "Harbour lights"), withdrawn("w2", 9, "Winter orchard")];

  it("labels the row with its lot number", () => {
    expect(toWithdrawnRowVM(withdrawn("w1", 3))).toMatchObject({ lotLabel: "Lot 3" });
    expect(toWithdrawnRowVM(withdrawn("w1", null))).toMatchObject({ lotLabel: null });
  });

  it("keeps every withdrawn lot in an unfiltered catalogue", () => {
    expect(withdrawnRowsFor(rows, { statusFilter: null, catalogSearch: "" })).toHaveLength(2);
  });

  it("drops them under a status chip, since a withdrawn lot has no live, upcoming or ended state", () => {
    expect(withdrawnRowsFor(rows, { statusFilter: "live", catalogSearch: "" })).toEqual([]);
  });

  it("matches a search on the title", () => {
    const found = withdrawnRowsFor(rows, { statusFilter: null, catalogSearch: " HARBOUR " });
    expect(found.map((r) => r.id)).toEqual(["w1"]);
  });
});

describe("mergeCatalogueRows", () => {
  const lots = [lot("a", 1), lot("b", 2), lot("d", 4), lot("e", 5)];

  it("puts a withdrawn lot at its number in lot order", () => {
    const merged = mergeCatalogueRows(lots, [toWithdrawnRowVM(withdrawn("w", 3))], "lot");
    expect(keys(merged)).toEqual(["lot:a", "lot:b", "withdrawn:w", "lot:d", "lot:e"]);
  });

  it("keeps a withdrawn lot after the last lot when its number is higher", () => {
    const merged = mergeCatalogueRows(lots, [toWithdrawnRowVM(withdrawn("w", 9))], "lot");
    expect(keys(merged).at(-1)).toBe("withdrawn:w");
  });

  it("orders several withdrawn lots by number", () => {
    const merged = mergeCatalogueRows(
      lots,
      [toWithdrawnRowVM(withdrawn("w9", 9)), toWithdrawnRowVM(withdrawn("w0", 0))],
      "lot",
    );
    expect(keys(merged)).toEqual([
      "withdrawn:w0",
      "lot:a",
      "lot:b",
      "lot:d",
      "lot:e",
      "withdrawn:w9",
    ]);
  });

  it.each(["priceAsc", "priceDesc", "endingAsc"] as const)("pins them last on %s", (sort) => {
    const merged = mergeCatalogueRows(lots, [toWithdrawnRowVM(withdrawn("w", 3))], sort);
    expect(keys(merged)).toEqual(["lot:a", "lot:b", "lot:d", "lot:e", "withdrawn:w"]);
  });

  it("returns the lots untouched when nothing was withdrawn", () => {
    expect(keys(mergeCatalogueRows(lots, [], "lot"))).toEqual(["lot:a", "lot:b", "lot:d", "lot:e"]);
  });
});
