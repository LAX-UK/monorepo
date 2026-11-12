import type { Database } from "@auction/db";
import { artworkRegister, lot } from "@auction/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import type { RegisterLotMismatch } from "../../interfaces/artwork-register-integrity.js";

/**
 * The lot is live in the sense the register means: published and waiting or running, or ended with
 * a winner who has yet to pay (payment moves the entry to sold).
 */
const lotIsLive = sql`(
  ${lot.id} IS NOT NULL
  AND ${lot.deletedAt} IS NULL
  AND (
    ${lot.status} IN ('scheduled', 'active')
    OR (${lot.status} = 'ended' AND ${lot.winnerId} IS NOT NULL)
  )
)`;

/** One query for both the staff inbox and the nightly check, so they never disagree. */
export async function findRegisterLotMismatches(
  db: Database,
  limit: number,
): Promise<RegisterLotMismatch[]> {
  const rows = await db
    .select({
      registerId: artworkRegister.id,
      stockCode: artworkRegister.stockCode,
      title: artworkRegister.title,
      changedAt: artworkRegister.updatedAt,
      lotId: lot.id,
      lotStatus: lot.status,
      lotDeletedAt: lot.deletedAt,
    })
    .from(artworkRegister)
    .leftJoin(lot, sql`${lot.id}::text = ${artworkRegister.offerRefId}`)
    .where(and(eq(artworkRegister.offerState, "bid_sale"), sql`NOT ${lotIsLive}`))
    .orderBy(asc(artworkRegister.updatedAt), asc(artworkRegister.id))
    .limit(limit);
  return rows.map((row) => ({
    registerId: row.registerId,
    stockCode: row.stockCode,
    title: row.title,
    changedAt: row.changedAt,
    lotId: row.lotId,
    lotStatus: row.lotDeletedAt === null ? row.lotStatus : null,
  }));
}
