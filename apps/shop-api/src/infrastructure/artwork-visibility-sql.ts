import { shopArtist, shopArtwork, shopEdition } from "@auction/db/schema";
import type { AdminArtworkState } from "@auction/shop-contracts";
import { type SQL, and, isNotNull, isNull, sql } from "drizzle-orm";

/**
 * On the storefront: published and not archived. Every public catalogue read (lists, detail,
 * facets, artist pages, editorial links, saved artworks, basket and checkout) applies this, so a
 * draft or an archived artwork is never shown or sold.
 */
export function publicArtworkVisible(): SQL {
  return and(isNotNull(shopArtwork.publishedAt), isNull(shopArtwork.archivedAt)) as SQL;
}

/** An archived artist is hidden from both storefronts' artist directories and pages. */
export function publicArtistVisible(): SQL {
  return isNull(shopArtist.archivedAt);
}

/** For edition queries that do not join the artwork: the edition's artwork is on the storefront. */
export const editionArtworkOnStorefrontSql = sql`exists (
  select 1 from ${shopArtwork}
  where ${shopArtwork.id} = ${shopEdition.artworkId}
    and ${shopArtwork.publishedAt} is not null
    and ${shopArtwork.archivedAt} is null
)`;

/** Editions in the artwork's run, and how many are sold (staff reads only). */
export const artworkEditionCountSql = sql<number>`(
  select count(*)::int from ${shopEdition} where ${shopEdition.artworkId} = ${shopArtwork.id}
)`;
export const artworkSoldEditionCountSql = sql<number>`(
  select count(*)::int from ${shopEdition}
  where ${shopEdition.artworkId} = ${shopArtwork.id} and ${shopEdition.listingStatus} = 'sold'
)`;

/**
 * The staff state in SQL, for filtering and counting by view. Mirrors `artworkCatalogueState` in
 * `@auction/shop-domain`, which maps each row once it is read.
 */
export const artworkStateSql = sql<AdminArtworkState>`case
  when ${shopArtwork.archivedAt} is not null then 'archived'
  when ${shopArtwork.publishedAt} is null then 'draft'
  when ${shopArtwork.saleState} = 'sold'
    or (
      ${shopArtwork.eligibleForEditionAllocation}
      and ${artworkEditionCountSql} > 0
      and ${artworkSoldEditionCountSql} >= ${artworkEditionCountSql}
    ) then 'sold_out'
  else 'live'
end`;
