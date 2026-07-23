import { buildLotsListPageModel } from "@/lib/admin/build-lots-list-page-model";
import { lotActiveLensId, lotLensItems } from "@/lib/admin/catalog/lots-lenses";
import { describe, expect, it } from "vitest";

describe("buildLotsListPageModel", () => {
  it("maps attention lens to draft + needsPhotos query", () => {
    const model = buildLotsListPageModel(
      { lens: "attention", needsPhotos: "1", status: "draft" },
      { withdrawalsPending: 2 },
    );
    expect(model.activeLens).toBe("attention");
    expect(model.attentionLens).toBe(true);
    expect(model.query.needsPhotos).toBe(true);
    expect(model.query.status).toBe("draft");
  });

  it("exposes hasListFilters when advanced filters are active", () => {
    const model = buildLotsListPageModel({ q: "vase", artistId: "a1" }, { withdrawalsPending: 0 });
    expect(model.hasListFilters).toBe(true);
  });

  it("defaults to all lens", () => {
    const model = buildLotsListPageModel({}, { withdrawalsPending: 0 });
    expect(model.activeLens).toBe("all");
    expect(lotActiveLensId({})).toBe("all");
    expect(lotLensItems({}).map((l) => l.id)).toEqual([
      "all",
      "live",
      "draft",
      "ending",
      "attention",
    ]);
  });
});
