import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminCategoryEditPage } from "./load-category-edit-page";

const { getCategory, getAllCategories } = vi.hoisted(() => ({
  getCategory: vi.fn(),
  getAllCategories: vi.fn(),
}));

vi.mock("@/lib/admin/load-category-detail", () => ({
  loadAdminCategoryDetail: getCategory,
}));

vi.mock("@/lib/data/http/admin.server", () => ({
  getAdminCategoryList: getAllCategories,
}));

describe("loadAdminCategoryEditPage", () => {
  beforeEach(() => {
    getCategory.mockResolvedValue({ id: "cat-1", name: "Paintings" });
    getAllCategories.mockResolvedValue([
      { id: "cat-1", name: "Paintings" },
      { id: "cat-2", name: "Sculpture" },
    ]);
  });

  it("loads category edit bundle", async () => {
    const model = await loadAdminCategoryEditPage("cat-1");
    expect(model.category.name).toBe("Paintings");
    expect(model.allCategories).toHaveLength(2);
    expect(model.overviewHref).toBe("/admin/categories/cat-1");
  });
});
