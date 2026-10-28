import type { Database } from "@auction/db";
import { lot, payment, sale } from "@auction/db/schema";
import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { IUnpaidPurchasesReader, UnpaidPurchaseRow } from "../interfaces/index.js";
import { lotCurrencySql } from "./organisation-dashboard.sql.js";

/** A win is settled once its payment is captured, or refunded after capture. */
const SETTLED_PAYMENT = sql`(${payment.status} in ('captured', 'refunded'))`;

/** The organisation's wins with no settled payment, with what their total is worked out from. */
export class DrizzleUnpaidPurchasesReader implements IUnpaidPurchasesReader {
  constructor(private readonly db: Database) {}

  async list(legalEntityId: string, limit: number): Promise<UnpaidPurchaseRow[]> {
    const rows = await this.db
      .select({
        lotId: lot.id,
        hammer: lot.currentPrice,
        lotPremiumRate: lot.buyerPremiumRate,
        saleTiers: sale.buyerPremiumTiers,
        currency: lotCurrencySql,
      })
      .from(lot)
      .leftJoin(sale, eq(sale.id, lot.saleId))
      .where(
        and(
          eq(lot.buyerLegalEntityId, legalEntityId),
          eq(lot.status, "ended"),
          isNotNull(lot.winnerId),
          isNull(lot.deletedAt),
          sql`not exists (select 1 from ${payment} where ${payment.lotId} = ${lot.id} and ${SETTLED_PAYMENT})`,
        ),
      )
      .orderBy(asc(lot.endTime))
      .limit(limit);
    return rows.map((row) => ({
      lotId: row.lotId,
      hammer: String(row.hammer),
      lotPremiumRate: String(row.lotPremiumRate),
      saleTiers: row.saleTiers ?? null,
      currency: row.currency,
    }));
  }
}
