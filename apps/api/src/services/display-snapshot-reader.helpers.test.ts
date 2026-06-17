import { describe, expect, it } from "vitest";
import {
  addMoneyStrings,
  computeLotQueue,
  parseDisplayLotEstimate,
} from "./display-snapshot-reader.helpers.js";

describe("parseDisplayLotEstimate", () => {
  it("returns null for missing or malformed estimate", () => {
    expect(parseDisplayLotEstimate(null)).toBeNull();
    expect(parseDisplayLotEstimate({})).toBeNull();
    expect(parseDisplayLotEstimate({ estimate: { low: "100" } })).toBeNull();
  });

  it("parses a valid estimate", () => {
    expect(
      parseDisplayLotEstimate({
        estimate: { low: "1000.00", high: "1500.00", currency: "GBP" },
      }),
    ).toEqual({ low: "1000.00", high: "1500.00", currency: "GBP" });
  });
});

describe("computeLotQueue", () => {
  const rows = [
    { id: "lot-1", lotNumber: 1, title: "One", images: [], marketingDetails: null },
    { id: "lot-2", lotNumber: 2, title: "Two", images: [], marketingDetails: null },
    { id: "lot-3", lotNumber: 3, title: "Three", images: [], marketingDetails: null },
  ];

  it("returns progress and next lot for current lot", () => {
    expect(computeLotQueue(rows, "lot-2")).toEqual({
      saleProgress: { position: 2, total: 3 },
      nextLotRow: rows[2],
    });
  });

  it("returns null next lot on last lot", () => {
    expect(computeLotQueue(rows, "lot-3")).toEqual({
      saleProgress: { position: 3, total: 3 },
      nextLotRow: null,
    });
  });

  it("returns first row as next when between lots", () => {
    expect(computeLotQueue(rows, null)).toEqual({
      saleProgress: null,
      nextLotRow: rows[0],
    });
  });
});

describe("addMoneyStrings", () => {
  it("adds decimal money strings", () => {
    expect(addMoneyStrings("500.00", "50.00")).toBe("550.00");
  });

  it("returns null for invalid input", () => {
    expect(addMoneyStrings("nope", "1.00")).toBeNull();
  });
});
