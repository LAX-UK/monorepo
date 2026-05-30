import { describe, expect, it } from "vitest";
import {
  resolveCatalogReadinessSurface,
  shouldShowCatalogReadinessRail,
} from "./catalog-detail-readiness-surface";
import type { CatalogReadinessResult } from "./catalog-readiness";

describe("catalog-detail-readiness-surface", () => {
  const readiness: CatalogReadinessResult = {
    items: [],
    completeCount: 1,
    totalCount: 2,
    percent: 50,
  };

  it("returns banner during post-create session", () => {
    expect(
      resolveCatalogReadinessSurface({
        readiness,
        isPostCreateBannerActive: true,
      }),
    ).toBe("banner");
    expect(
      shouldShowCatalogReadinessRail({
        readiness,
        isPostCreateBannerActive: true,
      }),
    ).toBe(false);
  });

  it("returns rail on return visits", () => {
    expect(
      resolveCatalogReadinessSurface({
        readiness,
        isPostCreateBannerActive: false,
      }),
    ).toBe("rail");
  });
});
