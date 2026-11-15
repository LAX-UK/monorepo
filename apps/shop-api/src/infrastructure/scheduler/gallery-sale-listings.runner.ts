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
 * Open checkouts and invoices are not cancelled here. The worker raised the "Zoho says Sold" item
 * before it recorded the sale, which holds payments for the artwork until staff deal with it.
 * Repeating a pass changes nothing.
 */
export function createGallerySaleListingsRunner(
  db: Database,
): (now: Date) => Promise<GallerySaleListingsResult> {
  return async (now) =>
    db.transaction(async (tx) => {
      const rows = await tx.execute<{
        id: string;
        zoho_product_id: string;
        register_id: string;
      }>(sql`
        UPDATE shop_artwork AS a
        SET published_at = NULL, updated_at = ${now}
        FROM artwork_register AS r
        WHERE a.id IN (
            SELECT candidate.id
            FROM shop_artwork AS candidate
            JOIN artwork_register AS sold ON sold.zoho_product_id = candidate.zoho_product_id
            WHERE sold.offer_state = 'sold'
              AND sold.offer_ref_kind = 'gallery_sale'
              AND candidate.published_at IS NOT NULL
              AND candidate.archived_at IS NULL
            ORDER BY candidate.id
            LIMIT ${BATCH}
            FOR UPDATE OF candidate SKIP LOCKED
          )
          AND r.zoho_product_id = a.zoho_product_id
        RETURNING a.id, a.zoho_product_id, r.id AS register_id
      `);
      for (const row of rows.rows) {
        await insertShopAdminAudit(tx as unknown as Database, {
          actorSubjectId: ACTOR,
          capability: "catalogue.write",
          action: "unpublish_artwork",
          targetType: "shop_artwork",
          targetId: row.id,
          beforeJson: { published: true, archived: false },
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
