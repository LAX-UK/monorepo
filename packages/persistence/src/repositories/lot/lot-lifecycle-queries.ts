import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import { lot, payment } from "@auction/db/schema";
import type { Lot } from "@auction/types";
import { and, eq, gt, inArray, isNotNull, lte, notExists } from "drizzle-orm";
import { mapLotsWithCategories } from "./lot-category-queries.js";

export async function findScheduledLotsToActivate(db: Database, asOf: Date): Promise<Lot[]> {
  const rows = await db
    .select()
    .from(lot)
    .where(and(eq(lot.status, "scheduled"), lte(lot.startTime, asOf), lotNotDeleted()));
  return mapLotsWithCategories(db, rows);
}

export async function findActiveLotsPastEnd(db: Database, asOf: Date): Promise<Lot[]> {
  const rows = await db
    .select()
    .from(lot)
    .where(and(eq(lot.status, "active"), lte(lot.endTime, asOf), lotNotDeleted()));
  return mapLotsWithCategories(db, rows);
}

export async function findActiveLotsByEndTimeBetween(
  db: Database,
  endAfter: Date,
  endBeforeInclusive: Date,
): Promise<Lot[]> {
  const rows = await db
    .select()
    .from(lot)
    .where(
      and(
        eq(lot.status, "active"),
        gt(lot.endTime, endAfter),
        lte(lot.endTime, endBeforeInclusive),
        lotNotDeleted(),
      ),
    );
  return mapLotsWithCategories(db, rows);
}

export async function findActiveDutchLots(db: Database): Promise<Lot[]> {
  const rows = await db
    .select()
    .from(lot)
    .where(and(eq(lot.status, "active"), eq(lot.auctionType, "dutch"), lotNotDeleted()));
  return mapLotsWithCategories(db, rows);
}

export async function listSoldLotIdsMissingPayment(db: Database, limit: number): Promise<string[]> {
  const rows = await db
    .select({ id: lot.id })
    .from(lot)
    .where(
      and(
        eq(lot.status, "ended"),
        isNotNull(lot.winnerId),
        notExists(db.select({ id: payment.id }).from(payment).where(eq(payment.lotId, lot.id))),
        lotNotDeleted(),
      ),
    )
    .orderBy(lot.endTime)
    .limit(limit);
  return rows.map((row) => row.id);
}

export async function markArchivedSellerOnDraftScheduledLots(
  db: Database,
  sellerLegalEntityId: string,
): Promise<number> {
  const updated = await db
    .update(lot)
    .set({ archivedSeller: true, updatedAt: new Date() })
    .where(
      and(
        eq(lot.sellerLegalEntityId, sellerLegalEntityId),
        inArray(lot.status, ["draft", "scheduled"]),
        lotNotDeleted(),
      ),
    )
    .returning({ id: lot.id });
  return updated.length;
}
