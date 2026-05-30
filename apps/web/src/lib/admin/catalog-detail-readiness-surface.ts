import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";

export type CatalogReadinessSurface = "banner" | "rail" | "none";

type Args = {
  readiness: CatalogReadinessResult | null | undefined;
  isPostCreateBannerActive: boolean;
};

/** Pick a single primary readiness surface per detail page visit. */
export function resolveCatalogReadinessSurface({
  readiness,
  isPostCreateBannerActive,
}: Args): CatalogReadinessSurface {
  if (!readiness || readiness.percent === 100) return "none";
  if (isPostCreateBannerActive) return "banner";
  return "rail";
}

export function shouldShowCatalogReadinessRail(args: Args): boolean {
  return resolveCatalogReadinessSurface(args) === "rail";
}

export function shouldShowCatalogReadinessBanner(args: Args): boolean {
  return resolveCatalogReadinessSurface(args) === "banner";
}
