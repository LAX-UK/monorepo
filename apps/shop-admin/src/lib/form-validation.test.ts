import { describe, expect, it } from "vitest";
import {
  collectFieldErrors,
  hasFieldErrors,
  parseWholeNumber,
  requiredText,
} from "./form-validation";

describe("collectFieldErrors", () => {
  it("keeps only the failed checks", () => {
    const errors = collectFieldErrors({ email: "Enter an email.", role: null });
    expect(errors).toEqual({ email: "Enter an email." });
    expect(hasFieldErrors(errors)).toBe(true);
    expect(hasFieldErrors(collectFieldErrors({ role: null }))).toBe(false);
  });
});

describe("requiredText", () => {
  it("treats whitespace as empty", () => {
    expect(requiredText("   ", "Required.")).toBe("Required.");
    expect(requiredText(" a ", "Required.")).toBeNull();
  });
});

describe("parseWholeNumber", () => {
  const bounds = { min: 1, max: 10 };
  it("accepts integers inside the bounds", () => {
    expect(parseWholeNumber("5", bounds, "bad")).toEqual({ ok: true, value: 5 });
  });
  it("rejects blank, fractional and out-of-range input", () => {
    for (const raw of ["", " ", "1.5", "0", "11", "abc"]) {
      expect(parseWholeNumber(raw, bounds, "bad")).toEqual({ ok: false, message: "bad" });
    }
  });
  it("has no upper bound unless one is given", () => {
    expect(parseWholeNumber("999999", { min: 0 }, "bad")).toEqual({ ok: true, value: 999999 });
  });
});
