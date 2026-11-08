import { describe, expect, it } from "vitest";
import { differingFields, planLedger, planPrintProduct } from "./plan-print-group.js";
import type { PrintGroupFacts } from "./print-group-facts.js";

const CODE = "LAX-PRT-MP-GAC-26-0037";
const facts: PrintGroupFacts = {
  printsArtworkId: "p1",
  title: "t",
  medium: null,
  dimensions: null,
  year: null,
  isMainRun: true,
  otherMainRunsOnOriginal: 0,
  original: { artworkId: "o1", zohoProductId: "zp-orig" },
  editionType: "Numbered",
  total: 24,
  collector: 10,
  artist: 10,
  lax: 4,
};
const agreeing = {
  Print_Group_ID: CODE,
  Total_Edition_Quantity: 24,
  Collector_Allocation: 10,
  Artist_Allocation: 10,
  LAX_Allocation: 4,
  Edition_Type: "Numbered" as const,
  Linked_Original_Artwork: "zp-orig",
};

describe("planPrintProduct", () => {
  it("writes the whole record when Zoho has none", () => {
    expect(planPrintProduct(CODE, facts, { printProduct: null, ledger: null })).toEqual(agreeing);
  });

  it("writes nothing when Zoho already agrees", () => {
    expect(
      planPrintProduct(CODE, facts, { printProduct: { id: "pp", fields: agreeing }, ledger: null }),
    ).toBeNull();
  });

  it("writes when a number moved", () => {
    expect(
      planPrintProduct(CODE, facts, {
        printProduct: { id: "pp", fields: { ...agreeing, LAX_Allocation: 3 } },
        ledger: null,
      }),
    ).toEqual(agreeing);
  });

  it("leaves alone a field LAX has no value for", () => {
    const noType = {
      ...facts,
      editionType: null,
      original: { artworkId: "o1", zohoProductId: null },
    };
    const { Edition_Type: _t, Linked_Original_Artwork: _l, ...rest } = agreeing;
    expect(
      planPrintProduct(CODE, noType, { printProduct: { id: "pp", fields: rest }, ledger: null }),
    ).toBeNull();
  });
});

describe("planLedger", () => {
  const ledger = {
    LAX_Mirror_Key: `group:${CODE}`,
    Linked_Print_Product_Group: "pp",
    Total_Edition: 24,
  };

  it("keys the ledger by the group's code and points it at the group", () => {
    expect(planLedger(CODE, facts, { printProduct: null, ledger: null }, "pp")).toEqual(ledger);
  });

  it("leaves the sold counters and Print_Sold out until the order mirror knows what sold", () => {
    const written = planLedger(CODE, facts, { printProduct: null, ledger: null }, "pp");
    expect(Object.keys(written ?? {}).sort()).toEqual([
      "LAX_Mirror_Key",
      "Linked_Print_Product_Group",
      "Total_Edition",
    ]);
    expect(
      Object.keys(planPrintProduct(CODE, facts, { printProduct: null, ledger: null }) ?? {}),
    ).not.toContain("Print_Sold");
  });

  it("writes nothing when the ledger already agrees", () => {
    expect(
      planLedger(CODE, facts, { printProduct: null, ledger: { id: "l", fields: ledger } }, "pp"),
    ).toBeNull();
  });
});

describe("differingFields", () => {
  it("lists only the wanted fields that differ", () => {
    expect(differingFields({ a: 1, b: 2, c: null }, { a: 1, b: 3 })).toEqual({ b: 2 });
  });
});
