import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminArtistCreatePage } from "./load-artist-create-page";

const { getCategoryTree } = vi.hoisted(() => ({
  getCategoryTree: vi.fn(),
}));

vi.mock("@/lib/data/http/categories.server", () => ({
  getServerCategoryReader: vi.fn(async () => ({
    tree: getCategoryTree,
  })),
}));

describe("loadAdminArtistCreatePage", () => {
  beforeEach(() => {
    getCategoryTree.mockResolvedValue([
      {
        id: "cat-1",
        name: "Paintings",
        slug: "paintings",
        parentId: null,
        sortOrder: 0,
        archived: false,
        description: null,
        heroImageKey: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  });

  it("loads taxonomy tree and parses optional query params", async () => {
    const model = await loadAdminArtistCreatePage({
      ownerUserId: " user-1 ",
      displayName: " Studio Name ",
      scenario: "maker-seller",
    });

    expect(getCategoryTree).toHaveBeenCalled();
    expect(model.categories).toHaveLength(1);
    expect(model.ownerUserId).toBe("user-1");
    expect(model.displayName).toBe("Studio Name");
    expect(model.initialScenario).toBe("maker-seller");
  });

  it("returns empty categories when fetch fails", async () => {
    getCategoryTree.mockRejectedValue(new Error("network"));
    const model = await loadAdminArtistCreatePage();
    expect(model.categories).toEqual([]);
  });
});
