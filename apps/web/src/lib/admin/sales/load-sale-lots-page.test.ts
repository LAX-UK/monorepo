import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadAdminSaleLotsPage } from "./load-sale-lots-page";

vi.mock("server-only", () => ({}));

const { loadDetail, getArtist, tree } = vi.hoisted(() => ({
  loadDetail: vi.fn(),
  getArtist: vi.fn(),
  tree: vi.fn(),
}));

vi.mock("@/lib/admin/load-sale-detail", () => ({ loadAdminSaleDetail: loadDetail }));
vi.mock("@/lib/data/http/admin.server", () => ({ getAdminArtistById: getArtist }));
vi.mock("@/lib/data/http/categories.server", () => ({
  getServerCategoryReader: vi.fn(async () => ({ tree })),
}));

const lot = (id: string, artistId: string | null) => ({ id, artistId });

describe("loadAdminSaleLotsPage", () => {
  beforeEach(() => {
    loadDetail.mockReset();
    getArtist.mockReset();
    tree.mockReset().mockResolvedValue([]);
  });

  it("names each lot's artist, looking each one up once", async () => {
    loadDetail.mockResolvedValue({
      sale: { id: "s1", status: "draft" },
      lots: [lot("l1", "a1"), lot("l2", "a1"), lot("l3", "a2"), lot("l4", null)],
    });
    getArtist.mockImplementation(async (id: string) =>
      id === "a1" ? { displayName: "Mary Fedden" } : { displayName: "John Piper" },
    );

    const page = await loadAdminSaleLotsPage("s1");

    expect(page.artistNameById).toEqual({ a1: "Mary Fedden", a2: "John Piper" });
    expect(getArtist).toHaveBeenCalledTimes(2);
  });

  it("leaves out an artist that cannot be read rather than failing the tab", async () => {
    loadDetail.mockResolvedValue({
      sale: { id: "s1", status: "scheduled" },
      lots: [lot("l1", "a1"), lot("l2", "gone")],
    });
    getArtist.mockImplementation(async (id: string) => {
      if (id === "gone") throw new Error("404");
      return { displayName: "Mary Fedden" };
    });

    const page = await loadAdminSaleLotsPage("s1");

    expect(page.artistNameById).toEqual({ a1: "Mary Fedden" });
  });
});
