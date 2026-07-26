import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminLotEditPage } from "./load-lot-edit-page";

const { loadLot, getCategories, getSales, getArtists, getDocuments } = vi.hoisted(() => ({
  loadLot: vi.fn(),
  getCategories: vi.fn(),
  getSales: vi.fn(),
  getArtists: vi.fn(),
  getDocuments: vi.fn(),
}));

vi.mock("@/lib/admin/load-lot-detail", () => ({
  loadAdminLotRecord: loadLot,
}));

vi.mock("@/lib/data/http/categories.server", () => ({
  getServerCategoryReader: vi.fn(async () => ({ tree: getCategories })),
}));

vi.mock("@/lib/admin/lot-form-sales", () => ({
  getLotFormAssignableSales: getSales,
}));

vi.mock("@/lib/data/http/admin.server", () => ({
  getAdminArtistList: getArtists,
}));

vi.mock("@/lib/data/http/lot-documents.server", () => ({
  getServerLotDocuments: getDocuments,
}));

vi.mock("@/lib/feature-flags/english-only-auctions", () => ({
  isEnglishOnlyAuctionsLocked: () => false,
}));

vi.mock("@/lib/forms/schemas/admin-lot-defaults", () => ({
  lotToAdminLotFormValues: (lot: { title?: string }) => ({ title: lot.title ?? "" }),
}));

describe("loadAdminLotEditPage", () => {
  beforeEach(() => {
    loadLot.mockResolvedValue({
      id: "lot-1",
      title: "Blue vase",
      status: "draft",
      saleId: "sale-1",
      marketingDetails: {},
    });
    getCategories.mockResolvedValue([]);
    getSales.mockResolvedValue({ sales: [] });
    getArtists.mockResolvedValue({ rows: [] });
    getDocuments.mockResolvedValue([]);
  });

  it("loads edit bundle for draft lot", async () => {
    const model = await loadAdminLotEditPage("lot-1");
    expect(model.redirectTo).toBeNull();
    expect(model.isDraft).toBe(true);
    expect(model.canEditCore).toBe(true);
  });

  it("returns redirect for ended lot", async () => {
    loadLot.mockResolvedValue({
      id: "lot-1",
      title: "Sold lot",
      status: "ended",
      marketingDetails: {},
    });
    const model = await loadAdminLotEditPage("lot-1");
    expect(model.redirectTo).toBe("/admin/lots/lot-1");
  });
});
