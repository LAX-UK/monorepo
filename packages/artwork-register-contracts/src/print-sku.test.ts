import { describe, expect, it } from "vitest";
import {
  PRINT_ALLOCATION_CODES,
  PRINT_FRAME_CODES,
  PRINT_PAPER_CODES,
  PRINT_SIZE_CODES,
  buildPrintSku,
  formatEditionLabel,
  parsePrintSku,
} from "./print-sku.js";

const GROUP = "LAX-PRT-MP-GAC-26-0037";
const parts = { groupCode: GROUP, size: "A3", paper: "COT", frame: "FRB", allocation: "ART" };

describe("buildPrintSku", () => {
  it("joins the group code and the four parts", () => {
    expect(buildPrintSku(parts)).toBe("LAX-PRT-MP-GAC-26-0037-A3-COT-FRB-ART");
  });

  it("accepts every allowed code in each position", () => {
    for (const size of PRINT_SIZE_CODES) expect(buildPrintSku({ ...parts, size })).not.toBeNull();
    for (const paper of PRINT_PAPER_CODES)
      expect(buildPrintSku({ ...parts, paper })).not.toBeNull();
    for (const frame of PRINT_FRAME_CODES)
      expect(buildPrintSku({ ...parts, frame })).not.toBeNull();
    for (const allocation of PRINT_ALLOCATION_CODES) {
      expect(buildPrintSku({ ...parts, allocation })).not.toBeNull();
    }
  });

  it("returns null for free text or lower case in any part", () => {
    expect(buildPrintSku({ ...parts, size: "A3 (297 x 420 mm)" })).toBeNull();
    expect(buildPrintSku({ ...parts, size: "a3" })).toBeNull();
    expect(buildPrintSku({ ...parts, size: "A0" })).toBeNull();
    expect(buildPrintSku({ ...parts, paper: "Hahnemuhle" })).toBeNull();
    expect(buildPrintSku({ ...parts, frame: "Black frame" })).toBeNull();
    expect(buildPrintSku({ ...parts, frame: "" })).toBeNull();
    expect(buildPrintSku({ ...parts, allocation: "original_buyer_entitlement" })).toBeNull();
  });

  it("returns null unless the group code is a print stock code", () => {
    expect(buildPrintSku({ ...parts, groupCode: "LAX-ORI-MP-GAC-26-0037" })).toBeNull();
    expect(buildPrintSku({ ...parts, groupCode: "nonsense" })).toBeNull();
    expect(buildPrintSku({ ...parts, groupCode: "" })).toBeNull();
  });

  it("writes a legacy PRI group as PRT", () => {
    expect(buildPrintSku({ ...parts, groupCode: "LAX-PRI-MP-GAC-26-0037" })).toBe(
      "LAX-PRT-MP-GAC-26-0037-A3-COT-FRB-ART",
    );
  });
});

describe("parsePrintSku", () => {
  it("reads back what buildPrintSku wrote", () => {
    const sku = buildPrintSku(parts) as string;
    expect(parsePrintSku(sku)).toEqual({ ...parts });
  });

  it("returns null for malformed SKUs", () => {
    expect(parsePrintSku("LAX-PRT-MP-GAC-26-0037")).toBeNull();
    expect(parsePrintSku("LAX-ORI-MP-GAC-26-0037-A3-COT-FRB-ART")).toBeNull();
    expect(parsePrintSku("LAX-PRT-MP-GAC-26-0037-A5-COT-FRB-ART")).toBeNull();
    expect(parsePrintSku("LAX-PRT-MP-GAC-26-0000-A3-COT-FRB-ART")).toBeNull();
    expect(parsePrintSku("")).toBeNull();
  });
});

describe("formatEditionLabel", () => {
  it("writes two-digit numbers", () => {
    expect(formatEditionLabel(7, 25)).toBe("ED 07/25");
    expect(formatEditionLabel(1, 5)).toBe("ED 01/05");
    expect(formatEditionLabel(25, 25)).toBe("ED 25/25");
    expect(formatEditionLabel(99, 99)).toBe("ED 99/99");
  });

  it("returns null for numbers that cannot be a print of the run", () => {
    expect(formatEditionLabel(0, 25)).toBeNull();
    expect(formatEditionLabel(26, 25)).toBeNull();
    expect(formatEditionLabel(7.5, 25)).toBeNull();
    expect(formatEditionLabel(7, 100)).toBeNull();
    expect(formatEditionLabel(-1, 25)).toBeNull();
    expect(formatEditionLabel(Number.NaN, 25)).toBeNull();
  });
});
