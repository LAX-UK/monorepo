import { formatDashboardFilterResults } from "@/lib/dashboard/filters/format-filter-results";
import { describe, expect, it } from "vitest";

describe("formatDashboardFilterResults", () => {
  it("formats zero results", () => {
    expect(formatDashboardFilterResults(0, "lots")).toBe("No lots match your filters");
  });

  it("formats singular and plural", () => {
    expect(formatDashboardFilterResults(1, "lots")).toBe("1 lot");
    expect(formatDashboardFilterResults(3, "payments")).toBe("3 payments");
  });
});
