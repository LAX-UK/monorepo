import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminSaleSetupPage } from "./load-sale-setup-page";

const { loadDetail, loadPendingRegistrationCount, getArtists, getCategories, getVenues } =
  vi.hoisted(() => ({
    loadDetail: vi.fn(),
    loadPendingRegistrationCount: vi.fn(),
    getArtists: vi.fn(),
    getCategories: vi.fn(),
    getVenues: vi.fn(),
  }));

vi.mock("@/lib/admin/load-sale-detail", () => ({
  loadAdminSaleDetail: loadDetail,
  loadAdminSalePendingRegistrationCount: loadPendingRegistrationCount,
}));

vi.mock("@/lib/data/http/admin.server", () => ({
  getAdminArtistList: getArtists,
}));

vi.mock("@/lib/data/http/categories.server", () => ({
  getServerCategoryReader: vi.fn(async () => ({ tree: getCategories })),
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
  saleToAdminSaleFormValues: (sale: { title?: string }) => ({ title: sale.title ?? "" }),
  buildCoverImagePreviewMap: () => ({}),
}));

vi.mock("@/lib/admin/sale-setup", () => ({
  resolveFirstIncompleteStep: () => "identity",
}));

describe("loadAdminSaleSetupPage", () => {
  beforeEach(() => {
    loadDetail.mockResolvedValue({
      sale: { id: "sale-1", title: "Draft sale", status: "draft", coverImages: [] },
      lots: [{ id: "lot-1", connectRequired: false }],
    });
    loadPendingRegistrationCount.mockResolvedValue(0);
    getCategories.mockResolvedValue([]);
    getArtists.mockResolvedValue({ rows: [] });
    getVenues.mockResolvedValue({ ok: true, data: { venues: [] } });
  });

  it("loads setup bundle for draft sale", async () => {
    const model = await loadAdminSaleSetupPage({
      saleId: "sale-1",
      role: "staff",
      staffRole: null,
    });
    expect(model.redirectTo).toBeNull();
    expect(model.sale.title).toBe("Draft sale");
    expect(model.initialStep).toBeDefined();
  });

  it("returns redirect for non-draft sale", async () => {
    loadDetail.mockResolvedValue({
      sale: { id: "sale-1", title: "Live sale", status: "active", coverImages: [] },
      lots: [],
    });
    const model = await loadAdminSaleSetupPage({
      saleId: "sale-1",
      role: "staff",
      staffRole: null,
    });
    expect(decodeURIComponent(model.redirectTo ?? "")).toContain(
      "Setup is only available for draft sales",
    );
  });
});
