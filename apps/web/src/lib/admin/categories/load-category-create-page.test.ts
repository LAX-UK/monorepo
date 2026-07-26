import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminCategoryCreatePage } from "./load-category-create-page";

const { getAllCategories } = vi.hoisted(() => ({
  getAllCategories: vi.fn(),
}));

vi.mock("@/lib/data/http/admin.server", () => ({
  getAdminCategoryList: getAllCategories,
}));

describe("loadAdminCategoryCreatePage", () => {
  beforeEach(() => {
    getAllCategories.mockResolvedValue([
      { id: "cat-1", name: "Paintings" },
      { id: "cat-2", name: "Sculpture" },
    ]);
  });

  it("loads taxonomy tree for parent picker", async () => {
    const model = await loadAdminCategoryCreatePage();
    expect(getAllCategories).toHaveBeenCalledWith({ includeArchived: true });
    expect(model.allCategories).toHaveLength(2);
  });

  it("returns setup error when fetch fails", async () => {
    getAllCategories.mockRejectedValue(new Error("network"));
    const model = await loadAdminCategoryCreatePage();
    expect(model.allCategories).toEqual([]);
    expect(model.setupError).toMatch(/could not load the category tree/i);
  });
});
