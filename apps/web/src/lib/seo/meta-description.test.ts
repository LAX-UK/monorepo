import { describe, expect, it } from "vitest";
import { normalizeMetaText, truncateMetaDescription } from "./meta-description";

describe("normalizeMetaText", () => {
  it("collapses whitespace", () => {
    expect(normalizeMetaText("  hello\n\nworld  ")).toBe("hello world");
  });
});

describe("truncateMetaDescription", () => {
  it("returns short text unchanged", () => {
    expect(truncateMetaDescription("Short lot title.")).toBe("Short lot title.");
  });

  it("truncates on word boundary with ellipsis", () => {
    const long =
      "A magnificent oil on canvas depicting the Thames at dusk with exceptional provenance from a private European collection assembled over several decades.";
    const result = truncateMetaDescription(long, 80);
    expect(result.length).toBeLessThanOrEqual(81);
    expect(result.endsWith("…")).toBe(true);
    expect(result).not.toMatch(/\s…$/);
  });
});
