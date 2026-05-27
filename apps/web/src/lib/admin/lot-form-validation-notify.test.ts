import { describe, expect, it } from "vitest";
import {
  buildLotFormValidationMessage,
  humanizeLotFormError,
  summarizeZodIssues,
} from "./lot-form-validation-notify";

describe("humanizeLotFormError", () => {
  it("humanizes lot schedule violations", () => {
    expect(humanizeLotFormError("Lot start must not be before the sale start time")).toBe(
      "This lot can’t open before the sale starts.",
    );
  });
});

describe("summarizeZodIssues", () => {
  it("returns a single humanized message", () => {
    expect(summarizeZodIssues([{ message: "Choose a sale" }])).toBe("Choose a sale");
  });

  it("appends count for additional issues", () => {
    const msg = summarizeZodIssues([
      { message: "Choose a sale" },
      { message: "Choose at least one category" },
      { message: "Start time required" },
    ]);
    expect(msg).toContain("Choose a sale");
    expect(msg).toContain("2 more fields");
  });

  it("uses fallback when no issues", () => {
    expect(summarizeZodIssues([])).toBe("Fix the highlighted fields before saving.");
  });
});

describe("buildLotFormValidationMessage", () => {
  it("never returns generic check-the-form copy", () => {
    const msg = buildLotFormValidationMessage({
      issues: [{ message: "Lot start must not be before the sale start time" }],
    });
    expect(msg).not.toContain("Check the form for errors");
    expect(msg).toContain("can’t open before the sale starts");
  });
});
