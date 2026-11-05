import { describe, expect, it } from "vitest";
import {
  StockCodeError,
  assertSeries,
  formatStockCode,
  formatStockCodePrefix,
  isStockCode,
  nextStockCode,
  nonConformingCodePart,
  parseStockCode,
  printCodeForOriginal,
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

  it("reads a print issued as PRT", () => {
    expect(parseStockCode("LAX-PRT-BA-PC-26-0008")).toEqual({
      kind: "print",
      artist: "BA",
      second: "PC",
      year: 26,
      number: 8,
    });
  });

  it("still reads a print issued as PRI", () => {
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

  it("reads legacy codes whose parts are shorter or longer than LAX issues", () => {
    expect(parseStockCode("LAX-ORI-A-GACGAC-26-0001")).toMatchObject({
      artist: "A",
      second: "GACGAC",
    });
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
  it("round-trips original and PRT samples", () => {
    for (const code of ["LAX-ORI-PH-GAC-26-0001", "LAX-PRT-BA-PC-26-0008"]) {
      const parts = parseStockCode(code);
      expect(parts && formatStockCode(parts)).toBe(code);
    }
  });

  it("writes a legacy PRI print as PRT", () => {
    const parts = parseStockCode("LAX-PRI-BA-PC-26-0008");
    expect(parts && formatStockCode(parts)).toBe("LAX-PRT-BA-PC-26-0008");
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

describe("issuing validation", () => {
  it.each([
    ["A", "GAC"],
    ["ABCD", "GAC"],
    ["A1", "GAC"],
    ["ab", "GAC"],
  ])("refuses artist code %j", (artist, second) => {
    expect(() => assertSeries({ kind: "original", artist, second })).toThrow(/Artist code/);
  });

  it.each(["G", "GACGA", "g1", "G-C"])("refuses collection code %j", (second) => {
    expect(() => assertSeries({ kind: "original", artist: "MP", second })).toThrow(
      /Collection code/,
    );
  });

  it.each([
    ["MP", "GAC"],
    ["GM", "S5"],
    ["PS", "HP"],
    ["TCB", "PC24"],
  ])("accepts %s / %s", (artist, second) => {
    expect(() => assertSeries({ kind: "original", artist, second })).not.toThrow();
  });
});

describe("nonConformingCodePart", () => {
  it("is null for conforming and unparseable codes", () => {
    expect(nonConformingCodePart("LAX-ORI-MP-GAC-26-0037")).toBeNull();
    expect(nonConformingCodePart("nonsense")).toBeNull();
  });

  it("names the part LAX would not issue today", () => {
    expect(nonConformingCodePart("LAX-ORI-M-GAC-26-0037")).toBe("artist");
    expect(nonConformingCodePart("LAX-ORI-MP-GACGAC-26-0037")).toBe("collection");
  });
});

describe("nextStockCode", () => {
  const prefix = { kind: "print", artist: "BA", second: "PC", year: 26 } as const;

  it("starts a run at 0001, issuing prints as PRT", () => {
    expect(nextStockCode(prefix, null)).toBe("LAX-PRT-BA-PC-26-0001");
  });

  it("continues after the highest number issued", () => {
    expect(nextStockCode(prefix, 8)).toBe("LAX-PRT-BA-PC-26-0009");
  });

  it("carries the number into a new registration year", () => {
    expect(nextStockCode({ ...prefix, year: 27 }, 37)).toBe("LAX-PRT-BA-PC-27-0038");
  });

  it("does not reuse a number when the run is full", () => {
    expect(nextStockCode(prefix, 9998)).toBe("LAX-PRT-BA-PC-26-9999");
    expect(() => nextStockCode(prefix, 9999)).toThrow(StockCodeError);
  });

  it("refuses to issue under a non-conforming artist or collection code", () => {
    expect(() => nextStockCode({ ...prefix, artist: "B" }, null)).toThrow(StockCodeError);
    expect(() => nextStockCode({ ...prefix, second: "PCPCP" }, null)).toThrow(StockCodeError);
  });
});

describe("printCodeForOriginal", () => {
  it("mirrors the original's artist, collection, year and number", () => {
    expect(printCodeForOriginal("LAX-ORI-MP-GAC-26-0037")).toBe("LAX-PRT-MP-GAC-26-0037");
  });

  it("refuses a print or a malformed code", () => {
    expect(() => printCodeForOriginal("LAX-PRT-MP-GAC-26-0037")).toThrow(StockCodeError);
    expect(() => printCodeForOriginal("nonsense")).toThrow(StockCodeError);
  });
});

describe("stock code prefix", () => {
  it("formats the shared prefix", () => {
    expect(formatStockCodePrefix({ kind: "original", artist: "PH", second: "GAC", year: 26 })).toBe(
      "LAX-ORI-PH-GAC-26",
    );
  });

  it("reads the prefix of an existing code", () => {
    expect(stockCodePrefixOf("LAX-PRT-BA-PC-26-0008")).toBe("LAX-PRT-BA-PC-26");
    expect(stockCodePrefixOf("LAX-PRI-BA-PC-26-0008")).toBe("LAX-PRT-BA-PC-26");
    expect(stockCodePrefixOf("nonsense")).toBeNull();
  });
});
