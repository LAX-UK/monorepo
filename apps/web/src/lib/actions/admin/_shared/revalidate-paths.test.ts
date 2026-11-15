import { beforeEach, describe, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({
  revalidateTag: (tag: string) => revalidateTag(tag),
  revalidatePath: vi.fn(),
}));
vi.mock("@/lib/actions/revalidate-catalogue", () => ({ revalidateCatalogueCache: vi.fn() }));

const { publicTagsForAdminLotEdit, revalidateAdminLotDetail } = await import("./revalidate-paths");

const LOT = "lot-1";

describe("staff lot edits purge every public page they change", () => {
  beforeEach(() => revalidateTag.mockClear());

  it("drops the lot page and the catalogue of its sale", () => {
    revalidateAdminLotDetail(LOT, ["sale-1"]);
    expect(revalidateTag.mock.calls.map(([tag]) => tag)).toEqual([
      "public-lot:lot-1",
      "public-sale:sale-1",
    ]);
  });

  it("drops both sales when the edit moves the lot", () => {
    expect(publicTagsForAdminLotEdit(LOT, ["sale-1", "sale-2"])).toEqual([
      "public-lot:lot-1",
      "public-sale:sale-1",
      "public-sale:sale-2",
    ]);
  });

  it("drops each tag once, and only the lot when it has no sale", () => {
    expect(publicTagsForAdminLotEdit(LOT, ["sale-1", "sale-1", null])).toEqual([
      "public-lot:lot-1",
      "public-sale:sale-1",
    ]);
    expect(publicTagsForAdminLotEdit(LOT)).toEqual(["public-lot:lot-1"]);
  });
});
