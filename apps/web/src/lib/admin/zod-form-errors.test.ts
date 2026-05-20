import { describe, expect, it, vi } from "vitest";
import { applyZodErrorsToForm, zodIssuePathForForm } from "./zod-form-errors";

describe("zodIssuePathForForm", () => {
  it("joins path segments with dots", () => {
    expect(zodIssuePathForForm(["buyerPremium", "tiers", 0, "rate"])).toBe(
      "buyerPremium.tiers.0.rate",
    );
  });
});

describe("applyZodErrorsToForm", () => {
  it("calls setError on the form", () => {
    const setError = vi.fn();
    const form = { setError } as never;
    applyZodErrorsToForm(form, "title", "Required");
    expect(setError).toHaveBeenCalledWith("title", { type: "manual", message: "Required" });
  });
});
