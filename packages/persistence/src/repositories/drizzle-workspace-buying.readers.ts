import type { Database } from "@auction/db";
import {
  bidIdentityDirectory,
  deliveryQuote,
  legalEntity,
  lot,
  lotFulfilment,
  payment,
  sale,
  saleRegistration,
} from "@auction/db/schema";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type {
  AccountPurchaseFactsRow,
  AccountRecordsScope,
  AccountRegistrationRow,
  IAccountPurchaseFactsReader,
  IAccountRegistrationsReader,
  IRecordPeopleReader,
} from "../interfaces/workspace-buying.readers.js";
import { mapDeliveryQuoteRow } from "./drizzle-delivery-quote.repository.js";

/** Sales the account is registered for, with who registered, newest sale first. */
export class DrizzleAccountRegistrationsReader implements IAccountRegistrationsReader {
  constructor(private readonly db: Database) {}

  async list(scope: AccountRecordsScope): Promise<AccountRegistrationRow[]> {
    const rows = await this.db
      .select({
        id: saleRegistration.id,
        saleId: saleRegistration.saleId,
        saleTitle: sale.title,
        saleStartsAt: sale.startTime,
        saleEndsAt: sale.endTime,
        status: saleRegistration.status,
        paddleNumber: saleRegistration.paddleNumber,
        bidLimit: saleRegistration.bidLimit,
        requestedAt: saleRegistration.requestedAt,
        decidedAt: saleRegistration.decidedAt,
        userId: saleRegistration.userId,
        userName: bidIdentityDirectory.name,
      })
      .from(saleRegistration)
      .innerJoin(sale, eq(sale.id, saleRegistration.saleId))
      .leftJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, saleRegistration.userId))
      .where(
        and(
          eq(saleRegistration.buyerLegalEntityId, scope.legalEntityId),
          isNull(sale.deletedAt),
          scope.memberUserId ? eq(saleRegistration.userId, scope.memberUserId) : undefined,
        ),
      )
      .orderBy(desc(sale.startTime), desc(saleRegistration.requestedAt))
      .limit(200);
    return rows.map(({ userId, userName, ...row }) => ({
      ...row,
      registeredBy: { userId, name: userName ?? null },
    }));
  }
}

/** Names from the identity directory, keyed by user id. */
export class DrizzleRecordPeopleReader implements IRecordPeopleReader {
  constructor(private readonly db: Database) {}

  async namesFor(userIds: readonly string[]): Promise<Map<string, string>> {
    const ids = [...new Set(userIds)];
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({ id: bidIdentityDirectory.subjectId, name: bidIdentityDirectory.name })
      .from(bidIdentityDirectory)
      .where(inArray(bidIdentityDirectory.subjectId, ids));
    return new Map(rows.map((r) => [r.id, r.name]));
  }
}

const OPEN_OR_SETTLED = ["pending", "authorized", "captured", "requires_manual_review", "refunded"];

/**
 * Lots won for the account with their invoice, fulfilment and courier quote. The invoice is the
 * open or settled payment for the lot and account (0251 keeps one); without one, the latest row.
 */
export class DrizzleAccountPurchaseFactsReader implements IAccountPurchaseFactsReader {
  constructor(private readonly db: Database) {}

  async list(
    scope: AccountRecordsScope & { lotIds?: readonly string[]; limit: number; offset: number },
  ): Promise<AccountPurchaseFactsRow[]> {
    if (scope.lotIds && scope.lotIds.length === 0) return [];
    const lots = await this.db
      .select({
        lotId: lot.id,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
        saleId: lot.saleId,
        saleTitle: sale.title,
        hammerPrice: lot.currentPrice,
        buyerAccountKind: legalEntity.kind,
        winnerId: lot.winnerId,
        winnerName: bidIdentityDirectory.name,
        wonAt: lot.endTime,
      })
      .from(lot)
      .innerJoin(legalEntity, eq(legalEntity.id, lot.buyerLegalEntityId))
      .leftJoin(sale, eq(sale.id, lot.saleId))
      .leftJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, lot.winnerId))
      .where(
        and(
          eq(lot.buyerLegalEntityId, scope.legalEntityId),
          eq(lot.status, "ended"),
          isNull(lot.deletedAt),
          scope.memberUserId ? eq(lot.winnerId, scope.memberUserId) : undefined,
          scope.lotIds ? inArray(lot.id, [...scope.lotIds]) : undefined,
        ),
      )
      .orderBy(desc(lot.endTime), desc(lot.id))
      .limit(scope.limit)
      .offset(scope.offset);
    if (lots.length === 0) return [];
    const lotIds = lots.map((l) => l.lotId);

    const [payments, fulfilments, quotes] = await Promise.all([
      this.db
        .select({
          id: payment.id,
          lotId: payment.lotId,
          status: payment.status,
          amount: payment.amount,
          raisedAt: payment.createdAt,
        })
        .from(payment)
        .where(
          and(inArray(payment.lotId, lotIds), eq(payment.buyerLegalEntityId, scope.legalEntityId)),
        )
        .orderBy(
          sql`CASE WHEN ${payment.status} IN (${sql.join(
            OPEN_OR_SETTLED.map((s) => sql`${s}`),
            sql`, `,
          )}) THEN 0 ELSE 1 END`,
          desc(payment.createdAt),
        ),
      this.db.select().from(lotFulfilment).where(inArray(lotFulfilment.lotId, lotIds)),
      this.db
        .select()
        .from(deliveryQuote)
        .where(
          and(
            inArray(deliveryQuote.lotId, lotIds),
            eq(deliveryQuote.buyerLegalEntityId, scope.legalEntityId),
          ),
        )
        .orderBy(
          sql`CASE WHEN ${deliveryQuote.status} = 'withdrawn' THEN 1 ELSE 0 END`,
          desc(deliveryQuote.requestedAt),
        ),
    ]);

    const paymentByLot = firstByLot(payments);
    const fulfilmentByLot = new Map(fulfilments.map((f) => [f.lotId, f]));
    const quoteByLot = firstByLot(quotes);

    return lots.map((l) => {
      const p = paymentByLot.get(l.lotId);
      const f = fulfilmentByLot.get(l.lotId);
      const q = quoteByLot.get(l.lotId);
      return {
        lotId: l.lotId,
        buyerAccountKind: l.buyerAccountKind,
        lotTitle: l.lotTitle,
        lotNumber: l.lotNumber,
        saleId: l.saleId,
        saleTitle: l.saleTitle,
        hammerPrice: l.hammerPrice,
        wonBy: l.winnerId ? { userId: l.winnerId, name: l.winnerName ?? null } : null,
        wonAt: l.wonAt,
        payment: p ? { id: p.id, status: p.status, amount: p.amount, raisedAt: p.raisedAt } : null,
        fulfilment: f
          ? {
              status: f.status,
              method: f.fulfilmentMethod,
              carrier: f.shippingCarrier,
              trackingNumber: f.trackingNumber,
              collectedBy: f.collectedBy,
              collectedAt: f.collectedAt,
            }
          : null,
        quote: q ? mapDeliveryQuoteRow(q) : null,
      };
    });
  }
}

/** The first row per lot, in the order the query sorted them. */
function firstByLot<T extends { lotId: string }>(rows: readonly T[]): Map<string, T> {
  const byLot = new Map<string, T>();
  for (const row of rows) if (!byLot.has(row.lotId)) byLot.set(row.lotId, row);
  return byLot;
}
