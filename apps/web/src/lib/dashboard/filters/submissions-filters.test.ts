import { describe, expect, it } from "vitest";
import {
  buildSubmissionsHref,
  hasSubmissionsActiveFilters,
  parseSubmissionsParams,
} from "./submissions/submissions-filters";

describe("submissions-filters", () => {
  it("parseSubmissionsParams applies defaults", () => {
    expect(parseSubmissionsParams({})).toEqual({ status: "all", q: "" });
  });

  it("parseSubmissionsParams trims and caps q", () => {
    const long = "x".repeat(250);
    expect(parseSubmissionsParams({ q: long }).q).toHaveLength(200);
  });

  it("buildSubmissionsHref preserves status when clearing q", () => {
    const current = parseSubmissionsParams({ status: "draft", q: "study" });
    expect(buildSubmissionsHref(current, { q: null })).toBe("/dashboard/submissions?status=draft");
  });

  it("hasSubmissionsActiveFilters detects status and q", () => {
    expect(hasSubmissionsActiveFilters(parseSubmissionsParams({ q: "portrait" }))).toBe(true);
    expect(hasSubmissionsActiveFilters(parseSubmissionsParams({ status: "submitted" }))).toBe(true);
    expect(hasSubmissionsActiveFilters(parseSubmissionsParams({}))).toBe(false);
  });
});
