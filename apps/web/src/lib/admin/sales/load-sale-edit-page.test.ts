import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminSaleEditPage } from "./load-sale-edit-page";

const { loadDetail, getCategories, getDocuments } = vi.hoisted(() => ({
  loadDetail: vi.fn(),
  getCategories: vi.fn(),
  getDocuments: vi.fn(),
}));

vi.mock("@/lib/admin/load-sale-detail", () => ({
  loadAdminSaleDetail: loadDetail,
}));

vi.mock("@/lib/data/http/categories.server", () => ({
  getServerCategoryReader: vi.fn(async () => ({ tree: getCategories })),
}));

vi.mock("@/lib/data/http/sale-documents.server", () => ({
  getServerSaleDocuments: getDocuments,
}));

vi.mock("@/lib/feature-flags/english-only-auctions", () => ({
  isEnglishOnlyAuctionsLocked: () => false,
}));

vi.mock("@/lib/forms/schemas/admin-sale-defaults", () => ({
  saleToAdminSaleFormValues: (sale: { title?: string }) => ({ title: sale.title ?? "" }),
  buildCoverImagePreviewMap: () => ({}),
}));

describe("loadAdminSaleEditPage", () => {
  beforeEach(() => {
    loadDetail.mockResolvedValue({
      sale: { id: "sale-1", title: "Spring sale", status: "draft", coverImages: [] },
      lots: [{ id: "lot-1" }],
    });
    getCategories.mockResolvedValue([{ id: "cat-1", name: "Paintings" }]);
    getDocuments.mockResolvedValue([{ id: "doc-1", title: "Terms" }]);
  });

  it("loads edit bundle", async () => {
    const model = await loadAdminSaleEditPage("sale-1");
    expect(model.saleId).toBe("sale-1");
    expect(model.categories).toHaveLength(1);
    expect(model.saleDocuments).toHaveLength(1);
    expect(model.lots).toHaveLength(1);
  });
});
