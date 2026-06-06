import { describe, expect, it } from "vitest";
import { resolvePaletteEmptyMessage } from "./palette-empty-state";

describe("resolvePaletteEmptyMessage", () => {
  it("guides single-character searches", () => {
    expect(resolvePaletteEmptyMessage("p")).toContain("one more character");
  });

  it("shows query-specific empty copy for record searches", () => {
    expect(resolvePaletteEmptyMessage("payment")).toContain("payment");
  });
});
