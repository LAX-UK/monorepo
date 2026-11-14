import { describe, expect, it } from "vitest";
import { framing, printLine } from "./order-facts.fixture.js";
import {
  dispatchStatusOf,
  frameCodeOf,
  paperCodeOf,
  planWrite,
  printSkuOf,
  sizeCodeOf,
  wantedPrintSku,
} from "./plan-order.js";

const GROUP = "LAX-PRT-MP-GAC-26-0037";

describe("SKU parts from staff's words", () => {
  it("reads the ISO size only when it leads the text", () => {
    expect(sizeCodeOf("A3")).toBe("A3");
    expect(sizeCodeOf(" a2 (42 x 59.4 cm)")).toBe("A2");
    expect(sizeCodeOf("A5")).toBeNull();
    expect(sizeCodeOf("50 x 70 cm, about A2")).toBeNull();
    expect(sizeCodeOf("A30")).toBeNull();
    expect(sizeCodeOf(null)).toBeNull();
  });

  it("reads the paper as its code or as exactly one paper's name", () => {
    expect(paperCodeOf("mun")).toBe("MUN");
    expect(paperCodeOf("Hahnemuhle Photo Rag")).toBe("HAH");
    expect(paperCodeOf("Hahnemühle")).toBe("HAH");
    expect(paperCodeOf("Canson Baryta Photographique")).toBe("BAR");
    expect(paperCodeOf("100% cotton rag")).toBe("COT");
    expect(paperCodeOf("Munken Pure")).toBe("MUN");
    // Two papers named, or none: never guessed.
    expect(paperCodeOf("Hahnemühle cotton")).toBeNull();
    expect(paperCodeOf("Somerset Velvet")).toBeNull();
    expect(paperCodeOf(null)).toBeNull();
  });

  it("takes the frame sold with the print, else the listing's code, else unframed", () => {
    expect(frameCodeOf(printLine({ framing: framing({ frame: "white_wood" }) }))).toBe("FRW");
    expect(frameCodeOf(printLine({ framing: framing({ frame: "natural_oak" }) }))).toBe("FRN");
    expect(frameCodeOf(printLine({ framing: framing({ frame: "gold_leaf" }) }))).toBeNull();
    // A refunded frame leaves the print as the listing sells it.
    expect(frameCodeOf(printLine({ framing: framing({ released: true }) }))).toBe("UNF");
    expect(frameCodeOf(printLine({ printFrame: "frb" }))).toBe("FRB");
    expect(frameCodeOf(printLine({ printFrame: "Unframed" }))).toBe("UNF");
    expect(frameCodeOf(printLine({ printFrame: "Oak, hand-finished" }))).toBeNull();
    expect(frameCodeOf(printLine({ framedByArtist: true }))).toBeNull();
    expect(frameCodeOf(printLine({ framedByArtist: true, printFrame: "FRN" }))).toBe("FRN");
  });
});

describe("printSkuOf", () => {
  it("builds the SKU from the group, the sheet, the frame and who held the print", () => {
    expect(printSkuOf(printLine(), GROUP)).toEqual({
      ok: true,
      value: {
        sku: `${GROUP}-A3-HAH-UNF-COL`,
        size: "A3",
        paper: "HAH",
        frame: "UNF",
        allocation: "COL",
      },
    });
    const framed = printSkuOf(printLine({ allocation: "artist", framing: framing() }), GROUP);
    expect(framed.ok && framed.value.sku).toBe(`${GROUP}-A3-HAH-FRB-ART`);
    const lax = printSkuOf(printLine({ allocation: "lax" }), GROUP);
    expect(lax.ok && lax.value.sku).toBe(`${GROUP}-A3-HAH-UNF-LAX`);
  });

  it("says which part cannot be worked out rather than guess", () => {
    expect(printSkuOf(printLine({ printSize: "50 x 70 cm" }), GROUP)).toEqual({
      ok: false,
      reason: 'print size "50 x 70 cm" has no SKU code',
    });
    expect(printSkuOf(printLine({ printPaper: null }), GROUP)).toEqual({
      ok: false,
      reason: 'paper "" has no SKU code',
    });
    expect(printSkuOf(printLine({ framedByArtist: true }), GROUP)).toEqual({
      ok: false,
      reason: "the frame has no SKU code",
    });
    expect(printSkuOf(printLine(), "LAX-ORI-MP-GAC-26-0037")).toMatchObject({ ok: false });
  });

  it("fills the Print_SKUs record and links it to its group", () => {
    const sku = printSkuOf(printLine(), GROUP);
    if (!sku.ok) throw new Error("sku");
    expect(wantedPrintSku(sku.value, printLine(), "pp-1")).toEqual({
      SKU: `${GROUP}-A3-HAH-UNF-COL`,
      Linked_Print_Product_Group: { id: "pp-1" },
      Size: "A3",
      Paper: "HAH",
      Frame: "UNF",
      Allocation_Bucket: "COL",
      Edition_Type: "Numbered",
    });
    expect(wantedPrintSku(sku.value, printLine(), null).Linked_Print_Product_Group).toBeNull();
  });
});

describe("dispatchStatusOf", () => {
  const at = (status: string, packed = false) =>
    dispatchStatusOf({ status, carrier: null, trackingNumber: null }, packed);

  it("follows the parcel from pack prep to delivered", () => {
    expect(at("pending_production")).toBeNull();
    expect(at("in_production")).toBeNull();
    expect(at("in_production", true)).toBe("Pack Prep");
    expect(at("pending_production", true)).toBe("Pack Prep");
    expect(at("awaiting_dispatch")).toBe("Ready");
    expect(at("ready_for_collection")).toBe("Ready");
    expect(at("in_transit")).toBe("Dispatched");
    expect(at("delivered")).toBe("Delivered");
    expect(at("collected")).toBe("Delivered");
  });

  it("has nothing to dispatch for a stored or cancelled fulfilment", () => {
    expect(at("in_storage", true)).toBeNull();
    expect(at("cancelled", true)).toBeNull();
  });
});

describe("planWrite", () => {
  const record = (fields: Record<string, unknown>) => ({ id: "rec-1", fields });

  it("writes every field LAX has a value for when there is no record", () => {
    expect(planWrite({ A: "x", B: null, C: 3 }, null)).toEqual({ A: "x", C: 3 });
  });

  it("writes only what differs, compares lookups by id and numbers read back as text", () => {
    expect(
      planWrite({ A: "x", L: { id: "pp-1" }, N: 3 }, record({ A: "x", L: "pp-1", N: "3" })),
    ).toBeNull();
    expect(planWrite({ A: "y", L: { id: "pp-2" } }, record({ A: "x", L: "pp-1" }))).toEqual({
      A: "y",
      L: { id: "pp-2" },
    });
    expect(planWrite({ A: "x" }, record({}))).toEqual({ A: "x" });
  });

  it("moves a dispatch status forward and still updates the courier and tracking", () => {
    const rank = { field: "Status", rank: "dispatch" as const };
    expect(
      planWrite(
        { Status: "Dispatched", Courier: "DPD", Tracking_Number: "123" },
        record({ Status: "In Transit", Courier: "Royal Mail", Tracking_Number: 123 }),
        rank,
      ),
    ).toEqual({ Courier: "DPD" });
    expect(planWrite({ Status: "Delivered" }, record({ Status: "In Transit" }), rank)).toEqual({
      Status: "Delivered",
    });
    expect(planWrite({ Status: "Ready" }, record({ Status: "Dispatched" }), rank)).toBeNull();
  });
});
