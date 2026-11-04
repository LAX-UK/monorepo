import { describe, expect, it } from "vitest";
import { withTemplate } from "./edition-run-form";
import {
  createOriginalAndPrintsLabel,
  createPrintsLabel,
  emptyOriginalPrintsForm,
  originalPrintsBody,
  originalPrintsCount,
  originalPrintsErrorSummary,
  originalPrintsTitle,
  validateOriginalPrintsForm,
} from "./original-prints-form";

const ORIGINAL = "Harbour at dusk";

describe("prints of an original", () => {
  it("starts off, as the LAX standard run, titled like the original", () => {
    const values = emptyOriginalPrintsForm();
    expect(values.enabled).toBe(false);
    expect(values.run.template).toBe("lax_standard");
    expect(originalPrintsTitle(values, "  Harbour at dusk ")).toBe(ORIGINAL);
    expect(validateOriginalPrintsForm(values, ORIGINAL)).toEqual({});
    expect(originalPrintsCount(values)).toBe(24);
  });

  it("follows the original's title until staff type their own", () => {
    const values = { ...emptyOriginalPrintsForm(true), titleOverride: "Harbour, signed" };
    expect(originalPrintsTitle(values, ORIGINAL)).toBe("Harbour, signed");
    expect(originalPrintsTitle({ ...values, titleOverride: null }, "Dusk")).toBe("Dusk");
  });

  it("asks for a title when the original has none yet and none was typed", () => {
    const errors = validateOriginalPrintsForm(emptyOriginalPrintsForm(true), "  ");
    expect(errors.title).toBe("Enter a title for the prints");
    expect(originalPrintsErrorSummary(errors, [])).toEqual([
      { fieldId: "original-prints-title", message: "Enter a title for the prints" },
    ]);
  });

  it("refuses a title over the limit", () => {
    expect(
      validateOriginalPrintsForm(emptyOriginalPrintsForm(true), "x".repeat(201)).title,
    ).toMatch(/200 characters/);
  });

  it("applies the run rules, with buyers allowed because the original is known", () => {
    const base = emptyOriginalPrintsForm(true);
    const custom = {
      ...base,
      run: {
        ...withTemplate(base.run, "custom_limited"),
        sizeText: "30",
        allocation: { buyer: "5", artist: "15", lax: "8" },
      },
    };
    const errors = validateOriginalPrintsForm(custom, ORIGINAL);
    expect(errors.allocation).toBe("Allocate every print: 2 are not allocated");
    expect(errors.original).toBeUndefined();
    expect(originalPrintsCount(custom)).toBeNull();
  });

  it("builds the body with the LAX standard run and no edition facts", () => {
    expect(originalPrintsBody(emptyOriginalPrintsForm(true), ORIGINAL)).toEqual({
      title: ORIGINAL,
      run: {
        spec: { type: "lax_standard" },
        proofsKept: { ap: 0, pp: 0, hc: 0, bat: 0 },
      },
    });
  });

  it("builds a custom run and the proofs kept", () => {
    const base = emptyOriginalPrintsForm(true);
    const values = {
      ...base,
      run: {
        ...withTemplate(base.run, "custom_limited"),
        sizeText: "30",
        allocation: { buyer: "5", artist: "15", lax: "10" },
        proofsKept: { ap: "3", pp: "", hc: "", bat: "" },
      },
    };
    expect(validateOriginalPrintsForm(values, ORIGINAL)).toEqual({});
    expect(originalPrintsBody(values, ORIGINAL).run).toEqual({
      spec: { type: "custom_limited", size: 30, allocation: { buyer: 5, artist: 15, lax: 10 } },
      proofsKept: { ap: 3, pp: 0, hc: 0, bat: 0 },
    });
    expect(originalPrintsCount(values)).toBe(30);
  });

  it("counts an open edition by its first batch", () => {
    const base = emptyOriginalPrintsForm(true);
    const open = { ...base, run: { ...withTemplate(base.run, "open"), firstBatchText: "20" } };
    expect(originalPrintsCount(open)).toBe(20);
    expect(originalPrintsBody(open, ORIGINAL).run.firstBatch).toMatchObject({
      artistCount: 10,
      laxCount: 10,
    });
    expect(originalPrintsCount({ ...open, run: { ...open.run, firstBatchText: "" } })).toBe(0);
  });

  it("words the buttons by the number of prints", () => {
    expect(createOriginalAndPrintsLabel(24)).toBe("Create original and 24 prints");
    expect(createOriginalAndPrintsLabel(1)).toBe("Create original and 1 print");
    expect(createOriginalAndPrintsLabel(0)).toBe("Create original and prints");
    expect(createOriginalAndPrintsLabel(null)).toBe("Create original and prints");
    expect(createPrintsLabel(24)).toBe("Create 24 prints");
    expect(createPrintsLabel(null)).toBe("Create prints");
  });
});
