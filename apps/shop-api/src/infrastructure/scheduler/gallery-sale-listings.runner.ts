import type { Database } from "@auction/db";
import { sql } from "drizzle-orm";
import { insertShopAdminAudit } from "../shop-admin-audit.js";

/** The most listings taken off sale in one pass; the next tick carries on. */
const BATCH = 100;
const ACTOR = "system:shop-scheduler";

export type GallerySaleListingsResult = { unpublished: number };

/**
 * Takes lax.art listings off sale once the artwork register records a sale made in the gallery
 * (Zoho said Sold; Zoho wins). Every listing linked to that Zoho record goes, the original's own
 * and any other Shop listing of it. Unpublishing is the same change staff make: `published_at`
 * is cleared, nothing is archived or deleted, and the audit log says the scheduler did it and why.
 * The register is not touched: it already shows the sale, so the listing's own offer has ended.
 *
 * Open checkouts and invoices are not cancelled here. Payments for the artwork are held for as
 * long as the register records the gallery sale (the money pause reads it), and the "Zoho says
 * Sold" item the worker raised tells staff what is still open.
 * Repeating a pass changes nothing.
 */
export function createGallerySaleListingsRunner(
  db: Database,
): (now: Date) => Promise<GallerySaleListingsResult> {
  return async (now) =>
    db.transaction(async (tx) => {
      // The candidates are locked and read first, so the audit can keep each listing's previous
      // `published_at` (UPDATE ... RETURNING only sees the new, cleared value).
      const rows = await tx.execute<{
        id: string;
        zoho_product_id: string;
        register_id: string;
        previous_published_at: Date | string;
      }>(sql`
        WITH candidate AS (
          SELECT listing.id, listing.published_at
          FROM shop_artwork AS listing
          JOIN artwork_register AS sold ON sold.zoho_product_id = listing.zoho_product_id
          WHERE sold.offer_state = 'sold'
            AND sold.offer_ref_kind = 'gallery_sale'
            AND listing.published_at IS NOT NULL
            AND listing.archived_at IS NULL
          ORDER BY listing.id
          LIMIT ${BATCH}
          FOR UPDATE OF listing SKIP LOCKED
        )
        UPDATE shop_artwork AS a
        SET published_at = NULL, updated_at = ${now}
        FROM candidate, artwork_register AS r
        WHERE a.id = candidate.id
          AND r.zoho_product_id = a.zoho_product_id
        RETURNING a.id, a.zoho_product_id, r.id AS register_id,
          candidate.published_at AS previous_published_at
      `);
      for (const row of rows.rows) {
        await insertShopAdminAudit(tx as unknown as Database, {
          actorSubjectId: ACTOR,
          capability: "catalogue.write",
          action: "unpublish_artwork",
          targetType: "shop_artwork",
          targetId: row.id,
          // Unpublishing is reversible: after a Reopen, staff can restore the original date.
          beforeJson: {
            published: true,
            archived: false,
            publishedAt: new Date(row.previous_published_at).toISOString(),
          },
          afterJson: {
            published: false,
            archived: false,
            reason: "sold_in_gallery",
            zohoProductId: row.zoho_product_id,
            registerId: row.register_id,
          },
        });
      }
      return { unpublished: rows.rows.length };
    });
}
