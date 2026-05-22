import { sparseGridClasses } from "@/lib/ui/sparse-grid-classes";
import { describe, expect, it } from "vitest";

describe("sparseGridClasses", () => {
  it("centers a single item", () => {
    expect(sparseGridClasses(1, { multi: "grid grid-cols-3" })).toContain("grid-cols-1");
    expect(sparseGridClasses(1, { multi: "grid grid-cols-3" })).toContain("max-w-md");
  });

  it("caps two items at two columns", () => {
    expect(sparseGridClasses(2, { multi: "grid lg:grid-cols-3" })).toContain("sm:grid-cols-2");
  });

  it("uses multi classes for three or more items", () => {
    expect(sparseGridClasses(5, { multi: "grid lg:grid-cols-3" })).toBe("grid lg:grid-cols-3");
  });
});
