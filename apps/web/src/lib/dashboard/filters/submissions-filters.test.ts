import { describe, expect, it } from "vitest";
import {
  buildSubmissionsHref,
  countSubmissionsSheetFilters,
  getSubmissionsActiveFilters,
  hasSubmissionsActiveFilters,
  parseSubmissionsParams,
  submissionStatusLabel,
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

  it("submissionStatusLabel derives from shared seller labels", () => {
    expect(submissionStatusLabel("draft")).toBe("Draft");
    expect(submissionStatusLabel("approved")).toBe("Accepted");
    expect(submissionStatusLabel("all")).toBe("All");
  });

  it("getSubmissionsActiveFilters emits status chip whose clear href omits status param", () => {
    const filters = parseSubmissionsParams({ status: "rejected" });
    const chips = getSubmissionsActiveFilters(filters);
    const statusChip = chips.find((chip) => chip.id === "status");
    expect(statusChip?.label).toBe("Status: Not accepted");
    expect(statusChip?.href).toBe("/dashboard/submissions");
  });

  it("countSubmissionsSheetFilters counts status only, not q", () => {
    expect(countSubmissionsSheetFilters(parseSubmissionsParams({ q: "study" }))).toBe(0);
    expect(countSubmissionsSheetFilters(parseSubmissionsParams({ status: "draft" }))).toBe(1);
  });
});
