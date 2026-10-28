import type { Database } from "@auction/db";
import { shopEditionFacts, shopOrder, shopOrderLine } from "@auction/db/schema";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { EditionFactsStore } from "../../application/edition-runs/edition-run.ports.js";
import { factsFromColumns, factsToColumns } from "../edition-facts-columns.js";

/** The facts of a run with their version, and the paid orders a correction would affect. */
export function createDrizzleEditionFactsStore(db: Database): EditionFactsStore {
  return {
    async get(artworkId) {
      const [row] = await db
        .select()
        .from(shopEditionFacts)
        .where(eq(shopEditionFacts.artworkId, artworkId))
        .limit(1);
      return row ? { facts: factsFromColumns(row), version: row.updatedAt.toISOString() } : null;
    },

    async save(artworkId, facts) {
      const columns = factsToColumns(facts);
      // clock_timestamp, not now(): two saves in one transaction still get distinct versions.
      const [row] = await db
        .insert(shopEditionFacts)
        .values({ artworkId, ...columns, updatedAt: sql`clock_timestamp()` })
        .onConflictDoUpdate({
          target: shopEditionFacts.artworkId,
          set: { ...columns, updatedAt: sql`clock_timestamp()` },
        })
        .returning({ updatedAt: shopEditionFacts.updatedAt });
      if (!row) throw new Error("Failed to save the edition facts");
      return row.updatedAt.toISOString();
    },

    async paidOrders(artworkId) {
      const rows = await db
        .selectDistinct({
          orderId: shopOrder.id,
          reference: shopOrder.reference,
          paidAt: shopOrder.paidAt,
        })
        .from(shopOrderLine)
        .innerJoin(shopOrder, eq(shopOrder.id, shopOrderLine.orderId))
        .where(and(eq(shopOrderLine.artworkId, artworkId), sql`${shopOrder.paidAt} is not null`))
        .orderBy(asc(shopOrder.paidAt), asc(shopOrder.id));
      return rows;
    },

    async keepOrderSnapshots(artworkId, snapshot) {
      const updated = await db
        .update(shopOrderLine)
        .set({ editionFactsSnapshot: snapshot })
        .where(
          and(
            eq(shopOrderLine.artworkId, artworkId),
            isNull(shopOrderLine.editionFactsSnapshot),
            sql`exists (
              select 1 from "shop_order" o
              where o."id" = "shop_order_line"."order_id" and o."paid_at" is not null
            )`,
          ),
        )
        .returning({ id: shopOrderLine.id });
      return updated.length;
    },
  };
}
