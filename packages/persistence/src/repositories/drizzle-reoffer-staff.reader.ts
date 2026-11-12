import type { Database } from "@auction/db";
import {
  bidIdentityDirectory,
  bidInvoice,
  buyerDefault,
  legalEntity,
  lot,
  payment,
} from "@auction/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import type {
  IReofferStaffReader,
  ReofferLotFacts,
  StaffBuyerDefaultView,
} from "../interfaces/reoffer-workflow.js";
import { decimalToPence } from "./lot-reoffer.mappers.js";

/**
 * What the staff screens read of a lot and its buyer default, none of it under a lock: the lot as
 * it stands, the default's facts with the voided invoice, and account names.
 */
export class DrizzleReofferStaffReader implements IReofferStaffReader {
  async lotFacts(db: Database, lotId: string): Promise<ReofferLotFacts | null> {
    const [row] = await db
      .select({
        id: lot.id,
        status: lot.status,
        winnerId: lot.winnerId,
        winnerLegalEntityId: lot.buyerLegalEntityId,
        reservePrice: lot.reservePrice,
        deletedAt: lot.deletedAt,
      })
      .from(lot)
      .where(eq(lot.id, lotId))
      .limit(1);
    if (!row) return null;
    const reservePence = row.reservePrice === null ? null : decimalToPence(row.reservePrice);
    return {
      id: row.id,
      status: row.status,
      winnerId: row.winnerId,
      winnerLegalEntityId: row.winnerLegalEntityId,
      reservePence: reservePence !== null && reservePence > 0 ? reservePence : null,
      deleted: row.deletedAt !== null,
    };
  }

  async latestDefaultView(db: Database, lotId: string): Promise<StaffBuyerDefaultView | null> {
    const [row] = await db
      .select({
        id: buyerDefault.id,
        recordedAt: buyerDefault.createdAt,
        recordedByName: bidIdentityDirectory.name,
        reason: buyerDefault.reason,
        outcome: buyerDefault.outcome,
        hammerPrice: buyerDefault.hammerPrice,
        wonAt: buyerDefault.wonAt,
        buyerRestricted: buyerDefault.buyerRestricted,
        buyerUserId: buyerDefault.buyerId,
        buyerAccountName: legalEntity.displayName,
        invoiceNumber: bidInvoice.number,
        invoiceTotal: bidInvoice.totalPence,
        invoiceDueAt: bidInvoice.dueAt,
      })
      .from(buyerDefault)
      .leftJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, buyerDefault.actorUserId))
      .leftJoin(legalEntity, eq(legalEntity.id, buyerDefault.buyerLegalEntityId))
      .leftJoin(payment, eq(payment.id, buyerDefault.paymentId))
      .leftJoin(bidInvoice, eq(bidInvoice.id, payment.invoiceId))
      .where(eq(buyerDefault.lotId, lotId))
      .orderBy(desc(buyerDefault.createdAt), desc(buyerDefault.id))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      recordedAt: row.recordedAt,
      recordedByName: row.recordedByName ?? null,
      reason: row.reason,
      outcome: row.outcome,
      originalHammerPence: decimalToPence(row.hammerPrice),
      wonAt: row.wonAt,
      buyerRestricted: row.buyerRestricted,
      buyerUserId: row.buyerUserId,
      buyerAccountName: row.buyerAccountName ?? null,
      voidedInvoiceNumber: row.invoiceNumber ?? null,
      voidedInvoiceTotalPence: row.invoiceTotal ?? null,
      voidedInvoiceDueAt: row.invoiceDueAt ?? null,
    };
  }

  async accountNames(
    db: Database,
    legalEntityIds: readonly string[],
  ): Promise<Map<string, string>> {
    if (legalEntityIds.length === 0) return new Map();
    const rows = await db
      .select({ id: legalEntity.id, name: legalEntity.displayName })
      .from(legalEntity)
      .where(inArray(legalEntity.id, [...legalEntityIds]));
    return new Map(rows.map((row) => [row.id, row.name]));
  }
}
