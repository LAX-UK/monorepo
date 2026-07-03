import type { Database } from "@auction/db";
import { bid, lot, payment, saleRegistration } from "@auction/db/schema";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { SaleSoftDeleteGuardCounts } from "../services/interfaces/sale-soft-delete.js";
import type { ISaleSoftDeleteGuardReader } from "./interfaces/sale-soft-delete-guard.reader.js";

function emptySaleGuardCounts(): SaleSoftDeleteGuardCounts {
  return { bidCount: 0, paymentCount: 0, approvedRegistrationCount: 0 };
}

export class DrizzleSaleSoftDeleteGuardReader implements ISaleSoftDeleteGuardReader {
  constructor(private readonly db: Database) {}

  async countGuardsForSale(saleId: string): Promise<SaleSoftDeleteGuardCounts> {
    const [bidRow] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(bid)
      .innerJoin(lot, eq(bid.lotId, lot.id))
      .where(and(eq(lot.saleId, saleId), isNull(lot.deletedAt)));

    const [paymentRow] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(payment)
      .innerJoin(lot, eq(payment.lotId, lot.id))
      .where(and(eq(lot.saleId, saleId), isNull(lot.deletedAt)));

    const [regRow] = await this.db
      .select({ n: sql<number>`count(*)::int` })
      .from(saleRegistration)
      .where(and(eq(saleRegistration.saleId, saleId), eq(saleRegistration.status, "approved")));

    return {
      bidCount: bidRow?.n ?? 0,
      paymentCount: paymentRow?.n ?? 0,
      approvedRegistrationCount: regRow?.n ?? 0,
    };
  }

  async countGuardsForSales(saleIds: string[]): Promise<Map<string, SaleSoftDeleteGuardCounts>> {
    const unique = [...new Set(saleIds.filter(Boolean))];
    const map = new Map<string, SaleSoftDeleteGuardCounts>();
    for (const id of unique) {
      map.set(id, emptySaleGuardCounts());
    }
    if (unique.length === 0) return map;

    const bidRows = await this.db
      .select({ saleId: lot.saleId, n: sql<number>`count(*)::int` })
      .from(bid)
      .innerJoin(lot, eq(bid.lotId, lot.id))
      .where(and(inArray(lot.saleId, unique), isNull(lot.deletedAt)))
      .groupBy(lot.saleId);

    const paymentRows = await this.db
      .select({ saleId: lot.saleId, n: sql<number>`count(*)::int` })
      .from(payment)
      .innerJoin(lot, eq(payment.lotId, lot.id))
      .where(and(inArray(lot.saleId, unique), isNull(lot.deletedAt)))
      .groupBy(lot.saleId);

    const regRows = await this.db
      .select({ saleId: saleRegistration.saleId, n: sql<number>`count(*)::int` })
      .from(saleRegistration)
      .where(and(inArray(saleRegistration.saleId, unique), eq(saleRegistration.status, "approved")))
      .groupBy(saleRegistration.saleId);

    for (const row of bidRows) {
      if (!row.saleId) continue;
      const current = map.get(row.saleId) ?? emptySaleGuardCounts();
      map.set(row.saleId, { ...current, bidCount: row.n ?? 0 });
    }
    for (const row of paymentRows) {
      if (!row.saleId) continue;
      const current = map.get(row.saleId) ?? emptySaleGuardCounts();
      map.set(row.saleId, { ...current, paymentCount: row.n ?? 0 });
    }
    for (const row of regRows) {
      const current = map.get(row.saleId) ?? emptySaleGuardCounts();
      map.set(row.saleId, { ...current, approvedRegistrationCount: row.n ?? 0 });
    }

    return map;
  }
}
