import { artworkCatalogueHref } from "@/lib/catalogue/artwork-catalogue-params";
import { isCatalogueArtworkSoldOut } from "@/lib/catalogue/catalogue-artwork-card.vm";
import { MARKETING_ROW_MAX_COLUMNS, marketingRowCap } from "@auction/marketing-ui";
import type { PublicArtworkSummary } from "@auction/shop-contracts";

export type HomeNewEditionsVm = {
  /** One row at most: a feature for one, a pair for two, a row of three or four. */
  items: PublicArtworkSummary[];
  /** "View all 6 editions", to every edition on sale. */
  viewAll: { label: string; href: string };
};

function editionsLabel(count: number): string {
  return count === 1 ? "1 edition" : `${count} editions`;
}

/**
 * "New editions": the newest editions on sale, without the first screen's release, as one row
 * that never starts a second, partial one. Sold-out editions never show here. `availableCount` is
 * every edition on sale, release included, which is what "View all" leads to.
 */
export function buildHomeNewEditions(input: {
  editions: readonly PublicArtworkSummary[];
  releaseSlug: string | null;
  availableCount: number | null;
}): HomeNewEditionsVm | null {
  const pool = input.editions.filter(
    (item) => item.slug !== input.releaseSlug && !isCatalogueArtworkSoldOut(item),
  );
  const items = pool.slice(0, marketingRowCap(pool.length, MARKETING_ROW_MAX_COLUMNS));
  if (items.length === 0) return null;
  const releaseShown = input.releaseSlug !== null ? 1 : 0;
  const total = Math.max(input.availableCount ?? 0, items.length + releaseShown);
  return {
    items,
    viewAll: {
      label: `View all ${editionsLabel(total)}`,
      href: artworkCatalogueHref({ sort: "newest", availability: "available" }),
    },
  };
}
