import { artworkCatalogueHref } from "@/lib/catalogue/artwork-catalogue-params";
import { isCatalogueArtworkSoldOut } from "@/lib/catalogue/catalogue-artwork-card.vm";
import { type EditionWorkGroup, groupEditionVersions } from "@/lib/catalogue/edition-work-group";
import { MARKETING_ROW_MAX_COLUMNS, marketingRowCap } from "@auction/marketing-ui";
import type { PublicArtworkSummary } from "@auction/shop-contracts";

export type HomeNewEditionsVm = {
  /** One row at most, one entry per work: a feature for one, a pair for two, a row of three or four. */
  groups: EditionWorkGroup[];
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
  /** The release's work, so its other versions do not come back as a second card of the same work. */
  releaseWorkSlug?: string | null;
  availableCount: number | null;
}): HomeNewEditionsVm | null {
  const releaseWork = input.releaseWorkSlug ?? input.releaseSlug;
  const pool = groupEditionVersions(
    input.editions.filter(
      (item) =>
        item.slug !== input.releaseSlug &&
        (releaseWork === null || (item.workSlug ?? item.slug) !== releaseWork) &&
        !isCatalogueArtworkSoldOut(item),
    ),
  );
  const groups = pool.slice(0, marketingRowCap(pool.length, MARKETING_ROW_MAX_COLUMNS));
  if (groups.length === 0) return null;
  const releaseShown = input.releaseSlug !== null ? 1 : 0;
  const total = Math.max(input.availableCount ?? 0, groups.length + releaseShown);
  return {
    groups,
    viewAll: {
      label: `View all ${editionsLabel(total)}`,
      href: artworkCatalogueHref({ sort: "newest", availability: "available" }),
    },
  };
}
