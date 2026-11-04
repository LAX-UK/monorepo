import { describe, expect, it } from "vitest";
import { CATALOGUE_GAPS, catalogueGapsOf } from "./catalogue-gaps.js";

const complete = { imageRefs: ["a.jpg"], dimensions: "40 x 50 cm", medium: "Oil on canvas" };

describe("catalogueGapsOf", () => {
  it("finds nothing missing on a complete record", () => {
    expect(catalogueGapsOf(complete)).toEqual([]);
  });

  it("reports each missing part in the fixed order", () => {
    expect(catalogueGapsOf({ imageRefs: [], dimensions: null, medium: null })).toEqual([
      ...CATALOGUE_GAPS,
    ]);
  });

  it("treats blank text as missing", () => {
    expect(catalogueGapsOf({ ...complete, dimensions: "  ", medium: "" })).toEqual([
      "size",
      "medium",
    ]);
  });

  it("reports a missing image alone", () => {
    expect(catalogueGapsOf({ ...complete, imageRefs: [] })).toEqual(["image"]);
  });
});
