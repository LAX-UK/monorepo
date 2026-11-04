import { describe, expect, it } from "vitest";
import {
  StockCodeError,
  formatStockCode,
  formatStockCodePrefix,
  isStockCode,
  nextStockCode,
  parseStockCode,
  stockCodePrefixOf,
} from "./stock-code.js";

describe("parseStockCode", () => {
  it("reads an original", () => {
    expect(parseStockCode("LAX-ORI-PH-GAC-26-0001")).toEqual({
      kind: "original",
      artist: "PH",
      second: "GAC",
      year: 26,
      number: 1,
    });
  });

  it("reads a print", () => {
    expect(parseStockCode("LAX-PRI-BA-PC-26-0008")).toEqual({
      kind: "print",
      artist: "BA",
      second: "PC",
      year: 26,
      number: 8,
    });
  });

  it("reads codes with a three-letter artist part", () => {
    expect(parseStockCode("LAX-ORI-TCB-PC-26-0042")?.artist).toBe("TCB");
  });

  it.each([
    "",
    "lax-ori-ph-gac-26-0001",
    "LAX-ORI-PH-GAC-26-001",
    "LAX-ORI-PH-GAC-26-00001",
    "LAX-ORI-PH-GAC-2026-0001",
    "LAX-XXX-PH-GAC-26-0001",
    "LAX-ORI-PH-26-0001",
    "LAX-ORI-PH-GAC-26-0000",
    "LAX-ORI--GAC-26-0001",
    "LAX-ORI-PH-GACGACG-26-0001",
    " LAX-ORI-PH-GAC-26-0001",
    "LAX-ORI-PH-GAC-26-0001 ",
    "ORI-PH-GAC-26-0001",
  ])("rejects %j", (value) => {
    expect(parseStockCode(value)).toBeNull();
    expect(isStockCode(value)).toBe(false);
  });
});

describe("formatStockCode", () => {
  it("round-trips the real samples", () => {
    for (const code of ["LAX-ORI-PH-GAC-26-0001", "LAX-PRI-BA-PC-26-0008"]) {
      const parts = parseStockCode(code);
      expect(parts && formatStockCode(parts)).toBe(code);
    }
  });

  it("pads the year and the number", () => {
    expect(
      formatStockCode({ kind: "original", artist: "AB", second: "CD", year: 5, number: 7 }),
    ).toBe("LAX-ORI-AB-CD-05-0007");
  });

  it("refuses a number outside 1 to 9999", () => {
    const base = { kind: "original", artist: "AB", second: "CD", year: 26 } as const;
    expect(() => formatStockCode({ ...base, number: 0 })).toThrow(StockCodeError);
    expect(() => formatStockCode({ ...base, number: 10000 })).toThrow(StockCodeError);
  });

  it("refuses malformed parts", () => {
    expect(() =>
      formatStockCode({ kind: "print", artist: "ba", second: "PC", year: 26, number: 1 }),
    ).toThrow(StockCodeError);
    expect(() =>
      formatStockCode({ kind: "print", artist: "BA", second: "P-C", year: 26, number: 1 }),
    ).toThrow(StockCodeError);
    expect(() =>
      formatStockCode({ kind: "print", artist: "BA", second: "PC", year: 126, number: 1 }),
    ).toThrow(StockCodeError);
  });
});

describe("nextStockCode", () => {
  const prefix = { kind: "print", artist: "BA", second: "PC", year: 26 } as const;

  it("starts a prefix at 0001", () => {
    expect(nextStockCode(prefix, null)).toBe("LAX-PRI-BA-PC-26-0001");
  });

  it("continues after the highest number issued", () => {
    expect(nextStockCode(prefix, 8)).toBe("LAX-PRI-BA-PC-26-0009");
  });

  it("does not reuse a number when the run is full", () => {
    expect(nextStockCode(prefix, 9998)).toBe("LAX-PRI-BA-PC-26-9999");
    expect(() => nextStockCode(prefix, 9999)).toThrow(StockCodeError);
  });
});

describe("stock code prefix", () => {
  it("formats the shared prefix", () => {
    expect(formatStockCodePrefix({ kind: "original", artist: "PH", second: "GAC", year: 26 })).toBe(
      "LAX-ORI-PH-GAC-26",
    );
  });

  it("reads the prefix of an existing code", () => {
    expect(stockCodePrefixOf("LAX-PRI-BA-PC-26-0008")).toBe("LAX-PRI-BA-PC-26");
    expect(stockCodePrefixOf("nonsense")).toBeNull();
  });
});
