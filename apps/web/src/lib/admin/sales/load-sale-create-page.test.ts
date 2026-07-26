import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminSaleCreatePage } from "./load-sale-create-page";

const { getSale, getArtists, getCategories, getPlatform, getVenues } = vi.hoisted(() => ({
  getSale: vi.fn(),
  getArtists: vi.fn(),
  getCategories: vi.fn(),
  getPlatform: vi.fn(),
  getVenues: vi.fn(),
}));

vi.mock("@/lib/data/http/admin.server", () => ({
  getAdminArtistList: getArtists,
  getAdminSaleById: getSale,
}));

vi.mock("@/lib/data/http/categories.server", () => ({
  getServerCategoryReader: vi.fn(async () => ({ tree: getCategories })),
}));

vi.mock("@/lib/data/http/platform-catalog.server", () => ({
  resolvePlatformCatalogLegalEntity: getPlatform,
}));

vi.mock("@/lib/data/write-container.server", () => ({
  getWriteContainer: () => ({
    adminVenues: { list: getVenues },
  }),
}));

vi.mock("@/lib/feature-flags/english-only-auctions", () => ({
  isEnglishOnlyAuctionsLocked: () => false,
}));

vi.mock("@/lib/forms/schemas/admin-sale-defaults", () => ({
  emptyAdminSaleFormValues: () => ({ title: "" }),
  saleToAdminSaleFormValues: (sale: { title?: string }) => ({ title: sale.title ?? "" }),
}));

describe("loadAdminSaleCreatePage", () => {
  beforeEach(() => {
    getCategories.mockResolvedValue([{ id: "cat-1", name: "Paintings" }]);
    getArtists.mockResolvedValue({ rows: [{ id: "art-1", displayName: "Artist" }] });
    getPlatform.mockResolvedValue({ ok: true, id: "le-1" });
    getVenues.mockResolvedValue({ ok: true, data: { venues: [{ id: "ven-1", name: "Gallery" }] } });
    getSale.mockResolvedValue(null);
  });

  it("loads blank create defaults", async () => {
    const model = await loadAdminSaleCreatePage({});
    expect(model.initialStep).toBe("identity");
    expect(model.cloneFailed).toBe(false);
    expect(model.categories).toHaveLength(1);
    expect(model.artists).toHaveLength(1);
    expect(model.venues).toHaveLength(1);
  });

  it("clones sale when fromSale is provided", async () => {
    getSale.mockResolvedValue({ sale: { title: "Spring sale", coverImages: [] } });
    const model = await loadAdminSaleCreatePage({ fromSale: "sale-1" });
    expect(model.wizardDraftEntityId).toBe("clone-sale-1");
    expect(model.defaultValues.title).toBe("Spring sale (copy)");
    expect(model.cloneFailed).toBe(false);
  });

  it("marks cloneFailed when source sale is missing", async () => {
    getSale.mockResolvedValue(null);
    const model = await loadAdminSaleCreatePage({ fromSale: "missing" });
    expect(model.cloneFailed).toBe(true);
  });
});
