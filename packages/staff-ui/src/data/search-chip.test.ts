import { describe, expect, it } from "vitest";
import { searchChipLabel } from "./toolbar.js";

describe("searchChipLabel", () => {
  it("words the search chip the same way on every list", () => {
    expect(searchChipLabel("ada")).toBe("Search: ada");
  });

  it("drops stray spaces around the query", () => {
    expect(searchChipLabel("  blue chip ")).toBe("Search: blue chip");
  });
});
