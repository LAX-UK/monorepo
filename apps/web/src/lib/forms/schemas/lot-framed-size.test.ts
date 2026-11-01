import { describe, expect, it } from "vitest";
import { framedSizeIssues, readFramedCm } from "./lot-framed-size";

describe("readFramedCm", () => {
  it("reads centimetres, allowing a comma for the decimal point", () => {
    expect(readFramedCm("62.5")).toEqual({ ok: true, value: 62.5 });
    expect(readFramedCm(" 62,5 ")).toEqual({ ok: true, value: 62.5 });
    expect(readFramedCm("90")).toEqual({ ok: true, value: 90 });
  });

  it("treats empty as not given", () => {
    expect(readFramedCm("")).toEqual({ ok: true, value: null });
    expect(readFramedCm(undefined)).toEqual({ ok: true, value: null });
  });

  it("refuses text, zero and sizes that are too large", () => {
    expect(readFramedCm("big")).toMatchObject({ ok: false });
    expect(readFramedCm("0")).toMatchObject({ ok: false, message: "Enter a size above zero" });
    expect(readFramedCm("12000")).toMatchObject({ ok: false, message: "That size is too large" });
    expect(readFramedCm("-5")).toMatchObject({ ok: false });
  });
});

describe("framedSizeIssues", () => {
  it("accepts both sides, or neither", () => {
    expect(framedSizeIssues("60", "80")).toEqual([]);
    expect(framedSizeIssues("", "")).toEqual([]);
  });

  it("asks for the missing side of a pair", () => {
    expect(framedSizeIssues("60", "")).toEqual([
      { field: "framedHeightCm", message: "Give both the framed width and the framed height" },
    ]);
    expect(framedSizeIssues("", "80")).toEqual([
      { field: "framedWidthCm", message: "Give both the framed width and the framed height" },
    ]);
  });

  it("names the side that is not a size", () => {
    expect(framedSizeIssues("abc", "80")).toEqual([
      { field: "framedWidthCm", message: "Enter a size in centimetres, like 62.5" },
    ]);
  });
});
