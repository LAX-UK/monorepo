import type { AdminCategory } from "@auction/types";
import { describe, expect, it } from "vitest";
import { buildCategoryOverviewViewModel } from "./build-category-overview-vm";

const category: AdminCategory = {
  id: "cat_1",
  name: "Paintings",
  slug: "paintings",
  parentId: null,
  archived: false,
  description: null,
  sortOrder: 0,
  heroImageKey: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-06-01"),
  usage: { lots: 12, sales: 3, submissions: 5, interests: 0, total: 20 },
};

describe("buildCategoryOverviewViewModel", () => {
  it("builds KPI tiles from taxonomy counts and usage", () => {
    const vm = buildCategoryOverviewViewModel(
      "cat_1",
      category,
      2,
      4,
      [],
      { items: [], completeCount: 0, totalCount: 0, percent: 100 },
      30,
    );

    expect(vm.kpiTiles).toHaveLength(5);
    expect(vm.kpiTiles[0]?.value).toBe("2");
    expect(vm.kpiTiles[2]?.value).toBe("12");
    expect(vm.summaryItems).toEqual([]);
  });
});
