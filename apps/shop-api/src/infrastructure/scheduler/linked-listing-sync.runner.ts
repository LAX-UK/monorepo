import type { Database } from "@auction/db";
import { shopArtworkImage } from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";

export type LinkedListingSyncResult = {
  /** Listings whose title, artist, medium, size or year moved to Zoho's. */
  details: number;
  /** Listings whose images were replaced with Zoho's. */
  images: number;
};

/**
 * Brings every lax.art original made from a register record in step with Zoho, which owns its
 * title, artist, medium, size, year and images. The register holds Zoho's current values (the Zoho
 * sync keeps it so); this copies them onto the listing, draft or live, and writes only what
 * differs, so a pass with nothing to do changes nothing. The artist follows Zoho's artist code; a
 * code no lax.art artist carries leaves the artist as it is. The web address never changes.
 *
 * Runs as Shop, because Shop owns the listing: the Zoho sync only ever writes the register.
 */
export function createLinkedListingSyncRunner(
  db: Database,
): (now: Date) => Promise<LinkedListingSyncResult> {
  return async () =>
    db.transaction(async (tx) => {
      const details = await tx.execute(sql`
        UPDATE shop_artwork AS a
        SET title = r.title,
            medium = r.medium,
            dimensions = r.dimensions,
            year_created = r.year,
            artist_id = COALESCE(artist.id, a.artist_id),
            updated_at = now()
        FROM artwork_register AS r
        LEFT JOIN shop_artist AS artist ON artist.zoho_artist_code = r.artist_code
        WHERE a.zoho_product_id = r.zoho_product_id
          AND a.sales_channel = 'art'
          AND a.eligible_for_edition_allocation = false
          AND (
            a.title IS DISTINCT FROM r.title
            OR a.medium IS DISTINCT FROM r.medium
            OR a.dimensions IS DISTINCT FROM r.dimensions
            OR a.year_created IS DISTINCT FROM r.year
            OR (artist.id IS NOT NULL AND a.artist_id <> artist.id)
          )
        RETURNING a.id
      `);

      const candidates = await tx.execute<{ id: string; image_refs: string[] }>(sql`
        SELECT a.id, r.image_refs
        FROM shop_artwork AS a
        JOIN artwork_register AS r ON r.zoho_product_id = a.zoho_product_id
        WHERE a.sales_channel = 'art'
          AND a.eligible_for_edition_allocation = false
          AND r.image_refs IS DISTINCT FROM COALESCE(
            (
              SELECT jsonb_agg(i.media_key ORDER BY i.position)
              FROM shop_artwork_image AS i
              WHERE i.artwork_id = a.id
            ),
            '[]'::jsonb
          )
      `);

      let images = 0;
      for (const row of candidates.rows) {
        const next = [...new Set(row.image_refs)];
        const current = await tx
          .select({ mediaKey: shopArtworkImage.mediaKey })
          .from(shopArtworkImage)
          .where(eq(shopArtworkImage.artworkId, row.id))
          .orderBy(shopArtworkImage.position);
        if (current.map((image) => image.mediaKey).join("\n") === next.join("\n")) continue;
        await tx.delete(shopArtworkImage).where(eq(shopArtworkImage.artworkId, row.id));
        if (next.length > 0) {
          await tx.insert(shopArtworkImage).values(
            next.map((mediaKey, position) => ({
              artworkId: row.id,
              mediaKey,
              position,
              alt: null,
            })),
          );
        }
        await tx.execute(sql`UPDATE shop_artwork SET updated_at = now() WHERE id = ${row.id}`);
        images += 1;
      }
      return { details: details.rows.length, images };
    });
}
