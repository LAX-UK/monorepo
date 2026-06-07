import { describe, expect, it } from "vitest";
import {
  submissionBlocksAccept,
  submissionHasQualityGaps,
  submissionQualityWarnings,
} from "./submission-quality-warnings";

describe("submissionQualityWarnings", () => {
  it("flags missing description and provenance as warnings", () => {
    const warnings = submissionQualityWarnings({
      title: "Vase",
      images: ["a.jpg"],
      description: "",
      provenance: [],
      categoryId: "cat-1",
    });
    expect(warnings).toContain("Catalogue description");
    expect(warnings).toContain("Provenance notes");
  });

  it("blocks accept when required fields are missing", () => {
    expect(
      submissionBlocksAccept({
        title: "",
        images: [],
        description: "ok",
        provenance: [],
        categoryId: "cat-1",
      }),
    ).toBe(true);
    expect(
      submissionHasQualityGaps({
        title: "Vase",
        images: ["a.jpg"],
        description: "",
        provenance: [],
        categoryId: "cat-1",
      }),
    ).toBe(true);
  });
});
