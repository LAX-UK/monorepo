import type { Database } from "@auction/db";
import {
  shopArtwork,
  shopEdition,
  shopEditionStockBatch,
  shopOrder,
  shopOrderLine,
  shopSaleAuthorityGrant,
} from "@auction/db/schema";
import { ShopDomainError } from "@auction/shop-domain";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { EditionPrintStore } from "../../application/edition-runs/edition-run.ports.js";
import { notFound } from "../../errors/shop-api-error.js";
import { isPgForeignKeyViolation } from "../../lib/pg-errors.js";
import { ensureLaxShopParty } from "../ensure-lax-party.js";
import { insertPlannedPrints } from "../insert-planned-editions.js";

/**
 * Prints offered for sale (now or before) and paid sales of a run, the two counts its locks
 * depend on. A sale is a paid shop order, or a print sold outside one (a third-party sale).
 */
export async function readRunUsage(db: Database, artworkId: string) {
  const [prints] = await db
    .select({
      authorised: sql<number>`count(*) filter (where ${shopEdition.saleAuthorisedAt} is not null or ${shopEdition.listingStatus} <> 'not_authorised')::int`,
      // Written qualified: a single-table select leaves column names bare, which the
      // correlated subquery would read as its own.
      soldOutsideOrders: sql<number>`count(*) filter (
        where "shop_edition"."listing_status" = 'sold'
        and not exists (
          select 1 from "shop_order_line" l
          join "shop_order" o on o."id" = l."order_id"
          where l."edition_id" = "shop_edition"."id" and o."paid_at" is not null
        )
      )::int`,
    })
    .from(shopEdition)
    .where(eq(shopEdition.artworkId, artworkId));
  const [orders] = await db
    .select({ paid: sql<number>`count(distinct ${shopOrder.id})::int` })
    .from(shopOrderLine)
    .innerJoin(shopOrder, eq(shopOrder.id, shopOrderLine.orderId))
    .where(and(eq(shopOrderLine.artworkId, artworkId), sql`${shopOrder.paidAt} is not null`));
  return {
    printsAuthorised: Number(prints?.authorised ?? 0),
    paidOrders: Number(orders?.paid ?? 0) + Number(prints?.soldOutsideOrders ?? 0),
  };
}

export function createDrizzleEditionPrintStore(db: Database): EditionPrintStore {
  return {
    async lockArtwork(artworkId) {
      const [row] = await db
        .select({
          id: shopArtwork.id,
          artistId: shopArtwork.artistId,
          slug: shopArtwork.slug,
          title: shopArtwork.title,
          sourceOriginalArtworkId: shopArtwork.sourceOriginalArtworkId,
          eligibleForEditionAllocation: shopArtwork.eligibleForEditionAllocation,
          updatedAt: shopArtwork.updatedAt,
        })
        .from(shopArtwork)
        .where(eq(shopArtwork.id, artworkId))
        .for("update")
        .limit(1);
      if (!row) return null;
      return {
        artworkId: row.id,
        artistId: row.artistId,
        slug: row.slug,
        title: row.title,
        sourceOriginalArtworkId: row.sourceOriginalArtworkId,
        sellsPrints: row.eligibleForEditionAllocation,
        updatedAt: row.updatedAt,
      };
    },

    usage: (artworkId) => readRunUsage(db, artworkId),

    createPrints: (input) => insertPlannedPrints(db, input),

    async clearPrints(artworkId) {
      try {
        await db.delete(shopEdition).where(eq(shopEdition.artworkId, artworkId));
        await db
          .delete(shopEditionStockBatch)
          .where(eq(shopEditionStockBatch.artworkId, artworkId));
      } catch (error) {
        // An order, hold or event still points at a print: the run is in use.
        if (isPgForeignKeyViolation(error)) {
          throw new ShopDomainError("Prints have been offered for sale, so the run is fixed");
        }
        throw error;
      }
    },

    async authoriseLaxPrints({ artworkId, stockRefs, actorSubjectId }) {
      if (stockRefs.length === 0) return 0;
      const laxPartyId = await ensureLaxShopParty(db);
      const now = new Date();
      const changed = await db
        .update(shopEdition)
        .set({ listingStatus: "authorised", saleAuthorisedAt: now })
        .where(
          and(
            eq(shopEdition.artworkId, artworkId),
            inArray(shopEdition.stockRef, [...stockRefs]),
            eq(shopEdition.ownerPartyId, laxPartyId),
            eq(shopEdition.listingStatus, "not_authorised"),
          ),
        )
        .returning({ id: shopEdition.id });
      const [onSale] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(shopEdition)
        .where(
          and(
            eq(shopEdition.artworkId, artworkId),
            eq(shopEdition.ownerPartyId, laxPartyId),
            eq(shopEdition.listingStatus, "authorised"),
          ),
        );
      // Every print on sale has a recorded authority, LAX's included.
      await db.insert(shopSaleAuthorityGrant).values({
        artworkId,
        ownerPartyId: laxPartyId,
        authorisedCount: Number(onSale?.count ?? 0),
        recordedBySubjectId: actorSubjectId,
        evidenceNote: "LAX's prints in a new stock batch, put on sale when added",
      });
      return changed.length;
    },

    async listedProofCount(mainRunId, proofType) {
      const [row] = await db
        .select({ listed: sql<number>`coalesce(sum(${shopArtwork.runSize}), 0)::int` })
        .from(shopArtwork)
        .where(
          and(
            eq(shopArtwork.mainRunArtworkId, mainRunId),
            eq(shopArtwork.runRole, "proof"),
            eq(shopArtwork.proofType, proofType),
            isNull(shopArtwork.archivedAt),
          ),
        );
      return Number(row?.listed ?? 0);
    },

    async touch(artworkId) {
      const [row] = await db
        .update(shopArtwork)
        .set({ updatedAt: new Date() })
        .where(eq(shopArtwork.id, artworkId))
        .returning({ updatedAt: shopArtwork.updatedAt });
      if (!row) throw notFound("Artwork not found");
      return row.updatedAt.toISOString();
    },
  };
}
