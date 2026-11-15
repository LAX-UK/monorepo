import { describe, expect, it } from "vitest";
import { framing, printLine } from "./order-facts.fixture.js";
import {
  dispatchStatusOf,
  editionAssigned,
  frameCodeOf,
  framingSpec,
  framingStatusOf,
  holdsUnrankedStatus,
  ledgerCounts,
  paperCodeOf,
  parcelPrints,
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

describe("editionAssigned", () => {
  it("labels a numbered print with its number over the run", () => {
    expect(editionAssigned(printLine())).toBe("ED 07/25");
  });

  it("falls back to the label at payment for open editions, proofs and runs past 99", () => {
    expect(editionAssigned(printLine({ editionType: "Open", printLabel: "OE-0021" }))).toBe(
      "OE-0021",
    );
    expect(editionAssigned(printLine({ editionNumber: null, printLabel: "AP 2/3" }))).toBe(
      "AP 2/3",
    );
    expect(editionAssigned(printLine({ runSize: 150, printLabel: "7/150" }))).toBe("7/150");
    expect(editionAssigned(printLine({ editionNumber: null, printLabel: " " }))).toBeNull();
  });
});

describe("parcelPrints", () => {
  it("lists each print's SKU with its edition, and nothing when there is no print", () => {
    expect(
      parcelPrints([
        { sku: "S-1", edition: "ED 07/25" },
        { sku: "S-2", edition: null },
      ]),
    ).toBe("S-1 ED 07/25; S-2");
    expect(parcelPrints([])).toBeNull();
  });
});

describe("ledgerCounts", () => {
  it("counts the run's sold prints by holder and in all", () => {
    expect(ledgerCounts({ collector: 3, artist: 1, lax: 2 })).toEqual({
      Assigned_To_Client: 3,
      Assigned_To_Artist: 1,
      Assigned_To_LAX: 2,
      Print_Sold: 6,
    });
  });
});

describe("framing", () => {
  it("describes the option, its parts, the lead time and the due date in one line", () => {
    expect(framingSpec(framing({ dueAt: new Date("2026-12-01T12:00:00Z") }))).toBe(
      "Gallery black: black wood frame, conservation window mount, UV acrylic glazing, D-rings and cord; lead time 10-15 working days; due 2026-12-01",
    );
    expect(framingSpec(framing({ leadTimeMinDays: 5, leadTimeMaxDays: 5, mount: "new" }))).toBe(
      "Gallery black: black wood frame, new, UV acrylic glazing, D-rings and cord; lead time 5 working days",
    );
  });

  it("maps the framing task to Zoho's status; a refunded frame is no longer required", () => {
    expect(framingStatusOf(framing(), false)).toBe("Queued");
    expect(framingStatusOf(framing({ taskStatus: "queued" }), false)).toBe("Queued");
    expect(framingStatusOf(framing({ taskStatus: "framing" }), false)).toBe("In Progress");
    expect(framingStatusOf(framing({ taskStatus: "framed" }), false)).toBe("Framed");
    expect(framingStatusOf(framing({ taskStatus: "completed" }), false)).toBe("Complete");
    expect(framingStatusOf(framing({ taskStatus: "cancelled" }), false)).toBe("Not Required");
    expect(framingStatusOf(framing({ taskStatus: "framed", released: true }), false)).toBe(
      "Not Required",
    );
    expect(framingStatusOf(framing({ taskStatus: "framed" }), true)).toBe("Not Required");
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

  it("moves a framing status forward and never back", () => {
    const rules = { status: { field: "Status", rank: "framing" as const } };
    expect(planWrite({ Status: "Framed" }, record({ Status: "Queued" }), rules)).toEqual({
      Status: "Framed",
    });
    // Staff moved the job on in Zoho; a late LAX step does not pull it back.
    expect(planWrite({ Status: "Framed" }, record({ Status: "QC Passed" }), rules)).toBeNull();
    expect(planWrite({ Status: "In Progress" }, record({ Status: "Framed" }), rules)).toBeNull();
    expect(planWrite({ Status: "Framed" }, record({ Status: "Framed" }), rules)).toBeNull();
    // Staff waiting on materials in Zoho is as far along as LAX's "in progress".
    expect(
      planWrite({ Status: "In Progress" }, record({ Status: "Awaiting Materials" }), rules),
    ).toBeNull();
    expect(planWrite({ Status: "Complete" }, record({ Status: "QC Passed" }), rules)).toEqual({
      Status: "Complete",
    });
    expect(planWrite({ Status: "Not Required" }, record({ Status: "Complete" }), rules)).toEqual({
      Status: "Not Required",
    });
    // An unset picklist is overwritten.
    expect(planWrite({ Status: "Queued" }, record({ Status: "-None-" }), rules)).toEqual({
      Status: "Queued",
    });
  });

  it("moves a dispatch status forward and still updates the courier and tracking", () => {
    const rank = { status: { field: "Status", rank: "dispatch" as const } };
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

  it("leaves a status Zoho holds that LAX does not rank, and fills one never set", () => {
    const status = { field: "Status", rank: "dispatch" as const };
    expect(
      planWrite({ Status: "Pack Prep" }, record({ Status: "QC Passed" }), { status }),
    ).toBeNull();
    expect(
      planWrite({ Status: "Delivered" }, record({ Status: "On Hold" }), { status }),
    ).toBeNull();
    for (const unset of [null, "", "-None-"]) {
      expect(planWrite({ Status: "Pack Prep" }, record({ Status: unset }), { status })).toEqual({
        Status: "Pack Prep",
      });
    }
    expect(holdsUnrankedStatus(record({ Status: "QC Passed" }), status)).toBe(true);
    expect(holdsUnrankedStatus(record({ Status: "Ready" }), status)).toBe(false);
    expect(holdsUnrankedStatus(record({ Status: "-None-" }), status)).toBe(false);
    expect(holdsUnrankedStatus(null, status)).toBe(false);
  });

  it("clears a field LAX owns once LAX holds no value for it, and only that field", () => {
    const clears = ["Tracking_Number"];
    expect(
      planWrite(
        { Tracking_Number: null, Courier: null },
        record({ Tracking_Number: "1", Courier: "DPD" }),
        {
          clears,
        },
      ),
    ).toEqual({ Tracking_Number: null });
    expect(
      planWrite({ Tracking_Number: null }, record({ Tracking_Number: "" }), { clears }),
    ).toBeNull();
    // A new record has nothing to clear.
    expect(planWrite({ A: "x", Tracking_Number: null }, null, { clears })).toEqual({ A: "x" });
  });
});
