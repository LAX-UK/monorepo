import type { EditorialLinkItem } from "@auction/shop-contracts";
import type { RelationRow } from "./editorial-links.vm";

/*
 * Artwork and artist rails in a page body store the public addresses (slugs) of what they show.
 * Staff pick records by name; these helpers turn that choice into the slugs the block keeps, and
 * the slugs back into names for editing, without changing the block's stored shape.
 */

/** The most records a rail can show; the content contract caps the list here. */
export const RAIL_MAX_ITEMS = 24;

export type RailKind = "artwork" | "artist";

/** A record a rail can hold, identified by its slug, which is what the block stores. */
export type RailRow = RelationRow & { slug: string };

export function railRowFromItem(item: EditorialLinkItem): RailRow {
  return {
    id: item.slug,
    slug: item.slug,
    title: item.title,
    subtitle: `/${item.slug}`,
    notPublic: !item.published,
  };
}

/** Shown for a slug no record answers to any more, so it can be seen and removed. */
export function missingRailRow(slug: string): RailRow {
  return {
    id: slug,
    slug,
    title: slug,
    subtitle: "No record has this address any more. Remove it or replace it.",
  };
}

/** What shows while names are still loading: the address, as it is stored. */
export function pendingRailRow(slug: string): RailRow {
  return { id: slug, slug, title: slug, subtitle: "Loading name…" };
}

/** The rows for a rail's stored slugs, in order, using the names known so far. */
export function railRowsFor(
  slugs: readonly string[],
  known: ReadonlyMap<string, RailRow>,
): RailRow[] {
  return slugs.map((slug) => known.get(slug) ?? pendingRailRow(slug));
}

/** The slugs to store, in the order the rows are in. */
export function railSlugs(rows: readonly RelationRow[]): string[] {
  return rows.map((row) => row.id);
}

/**
 * Names for slugs, from search results for each slug. A search matches titles and addresses, so
 * only an exact address counts; a slug with no exact match is reported as missing.
 */
export function matchRailSlugs(
  slugs: readonly string[],
  resultsBySlug: ReadonlyMap<string, readonly EditorialLinkItem[]>,
): Map<string, RailRow> {
  const rows = new Map<string, RailRow>();
  for (const slug of slugs) {
    const match = resultsBySlug.get(slug)?.find((item) => item.slug === slug);
    rows.set(slug, match ? railRowFromItem(match) : missingRailRow(slug));
  }
  return rows;
}
