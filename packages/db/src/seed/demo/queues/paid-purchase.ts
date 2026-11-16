import { eq } from "drizzle-orm";
import * as schema from "../../../schema/index.js";
import { DEMO_IDS } from "../demo-topup-ids.js";
import type { Db } from "../demo-topup-seed.js";

/** A lot the demo already sold and was paid for, with who bought it. */
export type PaidPurchase = {
  lotId: string;
  paymentId: string;
  buyerEntityId: string;
  buyerUserId: string | null;
};

/**
 * Finds the demo's paid lot by its number in the top-up catalogue. Throws when the top-up has not
 * run, because a queue item on a missing purchase would silently not appear.
 */
export async function loadPaidPurchase(db: Db, lotNumber: number): Promise<PaidPurchase> {
  const lotId = DEMO_IDS.lot(lotNumber);
  const [row] = await db
    .select({
      lotId: schema.lot.id,
      paymentId: schema.payment.id,
      status: schema.payment.status,
      buyerEntityId: schema.payment.buyerLegalEntityId,
      buyerUserId: schema.payment.buyerId,
    })
    .from(schema.lot)
    .innerJoin(schema.payment, eq(schema.payment.lotId, schema.lot.id))
    .where(eq(schema.lot.id, lotId))
    .limit(1);
  if (!row || row.status !== "captured") {
    throw new Error(`[demo-queues] needs the demo top-up: lot ${lotNumber} has no paid invoice`);
  }
  return {
    lotId: row.lotId,
    paymentId: row.paymentId,
    buyerEntityId: row.buyerEntityId,
    buyerUserId: row.buyerUserId,
  };
}
