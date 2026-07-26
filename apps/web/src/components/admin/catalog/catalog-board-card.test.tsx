import { catalogBoardCardClassName } from "@/components/admin/catalog/catalog-board-card";
import { describe, expect, it } from "vitest";

describe("catalogBoardCardClassName", () => {
  it("includes shell card surface tokens", () => {
    expect(catalogBoardCardClassName).toContain("rounded-shell-card");
    expect(catalogBoardCardClassName).toContain("border-shell-stroke");
    expect(catalogBoardCardClassName).toContain("shadow-[var(--shadow-rest)]");
  });
});
