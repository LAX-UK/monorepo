import { describe, expect, it } from "vitest";
import {
  penceToPoundsString,
  poundsStringToPence,
  staffFieldId,
  staffFormSummaryErrors,
} from "./staff-form-fields";

describe("staff form field bindings", () => {
  it("keeps pounds in the form as two-decimal strings", () => {
    expect(poundsStringToPence("1200.5")).toBe(120050);
    expect(poundsStringToPence("")).toBeNull();
    expect(poundsStringToPence("abc")).toBeNull();
    expect(penceToPoundsString(120050)).toBe("1200.50");
    expect(penceToPoundsString(null)).toBe("");
  });

  it("lists nested errors in field order, linking to each control", () => {
    const errors = {
      artistNote: { type: "max", message: "Shorten the note" },
      estimate: { low: { type: "custom", message: "Enter a low estimate" } },
      title: { type: "min", message: "Enter a title" },
      root: { type: "server", message: "Not saved" },
    };
    expect(staffFormSummaryErrors(errors as never, "lot-form", ["title", "estimate"])).toEqual([
      { fieldId: "lot-form-title", message: "Enter a title" },
      { fieldId: "lot-form-estimate-low", message: "Enter a low estimate" },
      { fieldId: "lot-form-artistNote", message: "Shorten the note" },
    ]);
    expect(staffFieldId("f", "provenance.0.period")).toBe("f-provenance-0-period");
  });
});
