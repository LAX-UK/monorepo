import type { Database } from "@auction/db";
import { bid, buyerDefault, lot, lotFulfilment, payment } from "@auction/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  BuyerDefaultConflictError,
  type BuyerDefaultLotFacts,
  type IBuyerDefaultReader,
  type IBuyerDefaultRepository,
  type RecordBuyerDefaultInput,
} from "../interfaces/buyer-default.js";
import { DrizzleLotTransitionGuardReader } from "./drizzle-lot-transition-guard.reader.js";

/** Payments that can still be voided: nothing has been paid or is being paid. */
const VOIDABLE = ["pending", "cancelled"] as const;
const OPEN_FIRST = ["pending", "authorized", "captured", "requires_manual_review", "refunded"];

export class DrizzleBuyerDefaultReader implements IBuyerDefaultReader {
  private readonly guards: DrizzleLotTransitionGuardReader;

  constructor(private readonly db: Database) {
    this.guards = new DrizzleLotTransitionGuardReader(db);
  }

  async readFacts(lotId: string): Promise<BuyerDefaultLotFacts | null> {
    const [row] = await this.db
      .select({
        id: lot.id,
        title: lot.title,
        lotNumber: lot.lotNumber,
        status: lot.status,
        saleId: lot.saleId,
        winnerId: lot.winnerId,
        buyerLegalEntityId: lot.buyerLegalEntityId,
        sellerLegalEntityId: lot.sellerLegalEntityId,
        hammerPrice: lot.currentPrice,
        wonAt: lot.endTime,
        deletedAt: lot.deletedAt,
      })
      .from(lot)
      .where(eq(lot.id, lotId))
      .limit(1);
    if (!row || row.deletedAt) return null;

    const [payments, fulfilment, bids, counts] = await Promise.all([
      row.buyerLegalEntityId
        ? this.db
            .select({
              id: payment.id,
              status: payment.status,
              amount: payment.amount,
              raisedAt: payment.createdAt,
            })
            .from(payment)
            .where(
              and(eq(payment.lotId, lotId), eq(payment.buyerLegalEntityId, row.buyerLegalEntityId)),
            )
            .orderBy(
              sql`CASE WHEN ${payment.status} IN (${sql.join(
                OPEN_FIRST.map((s) => sql`${s}`),
                sql`, `,
              )}) THEN 0 ELSE 1 END`,
              desc(payment.createdAt),
            )
            .limit(1)
        : Promise.resolve([]),
      this.db
        .select({ status: lotFulfilment.status })
        .from(lotFulfilment)
        .where(eq(lotFulfilment.lotId, lotId))
        .limit(1),
      this.db
        .select({
          userId: bid.bidderId,
          legalEntityId: bid.buyerLegalEntityId,
          amount: bid.amount,
        })
        .from(bid)
        .where(eq(bid.lotId, lotId)),
      this.guards.countForLot(lotId),
    ]);

    const p = payments[0];
    return {
      lot: {
        id: row.id,
        title: row.title,
        lotNumber: row.lotNumber,
        status: row.status,
        saleId: row.saleId,
        winnerId: row.winnerId,
        buyerLegalEntityId: row.buyerLegalEntityId,
        sellerLegalEntityId: row.sellerLegalEntityId,
        hammerPrice: String(row.hammerPrice),
        wonAt: row.wonAt,
      },
      payment: p
        ? { id: p.id, status: p.status, amount: String(p.amount), raisedAt: p.raisedAt }
        : null,
      fulfilmentStatus: fulfilment[0]?.status ?? null,
      hasOpenDispute: counts.openDisputeCount > 0,
      bids: bids.map((b) => ({ ...b, amount: String(b.amount) })),
    };
  }
}

export class DrizzleBuyerDefaultRepository implements IBuyerDefaultRepository {
  constructor(private readonly db: Database) {}

  async record(tx: Database, input: RecordBuyerDefaultInput): Promise<{ id: string }> {
    const [locked] = await tx
      .select({ status: lot.status, winnerId: lot.winnerId, entityId: lot.buyerLegalEntityId })
      .from(lot)
      .where(eq(lot.id, input.lotId))
      .for("update")
      .limit(1);
    if (
      !locked ||
      locked.status !== "ended" ||
      locked.winnerId !== input.buyerId ||
      locked.entityId !== input.buyerLegalEntityId
    ) {
      throw new BuyerDefaultConflictError();
    }

    if (input.paymentId) {
      const voided = await tx
        .update(payment)
        .set({ status: "cancelled" })
        .where(and(eq(payment.id, input.paymentId), inArray(payment.status, [...VOIDABLE])))
        .returning({ id: payment.id });
      if (voided.length === 0) throw new BuyerDefaultConflictError();
    }

    // The sale is cancelled: the buyer's purchase reads it as cancelled, never as owed.
    await tx
      .insert(lotFulfilment)
      .values({ lotId: input.lotId, paymentId: input.paymentId, status: "cancelled" })
      .onConflictDoUpdate({
        target: lotFulfilment.lotId,
        set: { status: "cancelled", updatedAt: new Date() },
      });

    // The lot has no buyer any more; the winning bid stays in its history, marked not winning.
    await tx
      .update(lot)
      .set({ winnerId: null, buyerLegalEntityId: null, updatedAt: new Date() })
      .where(eq(lot.id, input.lotId));
    await tx.update(bid).set({ isWinning: false }).where(eq(bid.lotId, input.lotId));

    const [row] = await tx
      .insert(buyerDefault)
      .values({
        lotId: input.lotId,
        paymentId: input.paymentId,
        buyerId: input.buyerId,
        buyerLegalEntityId: input.buyerLegalEntityId,
        sellerLegalEntityId: input.sellerLegalEntityId,
        hammerPrice: input.hammerPrice,
        wonAt: input.wonAt,
        reason: input.reason,
        outcome: input.outcome,
        offeredUserId: input.offeredUserId,
        offeredAmount: input.offeredAmount,
        buyerRestricted: input.buyerRestricted,
        actorUserId: input.actorUserId,
      })
      .returning({ id: buyerDefault.id });
    if (!row) throw new BuyerDefaultConflictError();
    return row;
  }

  async isVoided(paymentId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: buyerDefault.id })
      .from(buyerDefault)
      .where(eq(buyerDefault.paymentId, paymentId))
      .limit(1);
    return row !== undefined;
  }
}
