import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminLotCreatePage } from "./load-lot-create-page";

const { getLot, getCategories, getSales, getArtists } = vi.hoisted(() => ({
  getLot: vi.fn(),
  getCategories: vi.fn(),
  getSales: vi.fn(),
  getArtists: vi.fn(),
}));

vi.mock("@/lib/data/http/admin.server", () => ({
  getAdminLotById: getLot,
  getAdminArtistList: getArtists,
}));

vi.mock("@/lib/data/http/categories.server", () => ({
  getServerCategoryReader: vi.fn(async () => ({ tree: getCategories })),
}));

vi.mock("@/lib/admin/lot-form-sales", () => ({
  getLotFormAssignableSales: getSales,
}));

vi.mock("@/lib/feature-flags/english-only-auctions", () => ({
  isEnglishOnlyAuctionsLocked: () => false,
}));

vi.mock("@/lib/forms/schemas/admin-lot-defaults", () => ({
  emptyAdminLotFormValues: () => ({
    title: "",
    saleId: "",
    lotNumber: null,
    auctionType: "english",
  }),
  lotToAdminLotFormValues: (lot: { title?: string }) => ({
    title: lot.title ?? "",
    saleId: "",
    lotNumber: null,
    auctionType: "english",
  }),
}));

describe("loadAdminLotCreatePage", () => {
  beforeEach(() => {
    getCategories.mockResolvedValue([{ id: "cat-1", name: "Sculpture" }]);
    getSales.mockResolvedValue({
      sales: [{ id: "sale-1", title: "Draft sale", status: "draft" }],
      currentSale: null,
    });
    getArtists.mockResolvedValue({ rows: [{ id: "art-1", displayName: "Maker" }] });
    getLot.mockResolvedValue(null);
  });

  it("loads blank create defaults", async () => {
    const model = await loadAdminLotCreatePage({});
    expect(model.cloneFailed).toBe(false);
    expect(model.categories).toHaveLength(1);
    expect(model.sales).toHaveLength(1);
    expect(model.description).toBeNull();
  });

  it("clones lot when fromLot is provided", async () => {
    getLot.mockResolvedValue({ title: "Blue vase", auctionType: "english" });
    const model = await loadAdminLotCreatePage({ fromLot: "lot-12345678" });
    expect(model.defaultValues.title).toBe("Blue vase (copy)");
    expect(model.description).toContain("lot-1234");
  });

  it("assigns preset sale", async () => {
    getSales.mockResolvedValue({
      sales: [],
      currentSale: { id: "sale-2", title: "Live sale", status: "scheduled" },
    });
    const model = await loadAdminLotCreatePage({ saleId: "sale-2" });
    expect(model.defaultValues.saleId).toBe("sale-2");
    expect(model.emergencyAddSaleStatus).toBe("scheduled");
    expect(model.description).toContain("scheduled immediately");
  });
});
