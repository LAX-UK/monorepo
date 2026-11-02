import {
  disputeCase,
  disputeCaseCandidate,
  lot,
  lotFulfilment,
  payment,
  sale,
} from "@auction/db/schema";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { type ExportSource, SourcedExportCategory } from "../sourced-export-category.js";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import {
  iso,
  isoRequired,
  lotRef,
  money,
  moneyFromMinor,
  saleRef,
} from "../subject-export-values.js";
import { afterKey, countWhere } from "./keyset.js";

export type PurchaseInput = {
  lot: { id: string; title: string; lotNumber: number | null; currentPrice: string; endTime: Date };
  sale: { id: string; title: string } | null;
  /** The settlement for this lot, if one was raised. */
  invoice: { amount: string; createdAt: Date } | null;
  fulfilment: {
    method: string | null;
    status: string;
    carrier: string | null;
    trackingNumber: string | null;
    collectedAt: Date | null;
  } | null;
  disputes: {
    id: string;
    status: string;
    reason: string | null;
    amountPence: number;
    currency: string;
    openedAt: Date;
    closedAt: Date | null;
  }[];
};

/**
 * Bid keeps one settlement total per lot, so the premium is what the total adds to the hammer
 * price; separate fee and tax lines are not stored and are returned as null rather than guessed.
 * The seller's side (platform fee, seller entity, payout) and staff fulfilment notes are not selected.
 */
export function mapPurchase(input: PurchaseInput, webOrigin: string) {
  const hammer = money(input.lot.currentPrice);
  const total = input.invoice ? money(input.invoice.amount) : null;
  const premium =
    hammer && total && total.minor >= hammer.minor
      ? moneyFromMinor(total.minor - hammer.minor, total.currency)
      : null;
  return {
    id: input.lot.id,
    origin: "observed" as const,
    lot: { ...lotRef(input.lot, webOrigin), sale: saleRef(input.sale, webOrigin) },
    hammer,
    premium,
    fees: null,
    tax: null,
    total,
    fulfilment: input.fulfilment
      ? {
          method: input.fulfilment.method,
          status: input.fulfilment.status,
          carrier: input.fulfilment.carrier,
          trackingNumber: input.fulfilment.trackingNumber,
          collectedAt: iso(input.fulfilment.collectedAt),
        }
      : null,
    disputes: input.disputes.map((dispute) => ({
      id: dispute.id,
      status: dispute.status,
      reason: dispute.reason,
      amount: moneyFromMinor(dispute.amountPence, dispute.currency),
      openedAt: isoRequired(dispute.openedAt),
      closedAt: iso(dispute.closedAt),
    })),
    purchasedAt: isoRequired(input.lot.endTime),
  };
}

export class PurchasesCategory extends SourcedExportCategory {
  readonly id = "purchases";
  protected readonly sources: readonly ExportSource[];

  constructor(deps: SubjectExportDeps) {
    super();
    const { db, webOrigin } = deps;
    this.sources = [
      {
        count: (s) => countWhere(db, lot, eq(lot.winnerId, s)),
        page: async (s, after, limit) => {
          const lots = await db
            .select({
              id: lot.id,
              title: lot.title,
              lotNumber: lot.lotNumber,
              currentPrice: lot.currentPrice,
              endTime: lot.endTime,
              saleId: sale.id,
              saleTitle: sale.title,
            })
            .from(lot)
            .leftJoin(sale, eq(sale.id, lot.saleId))
            .where(and(eq(lot.winnerId, s), afterKey(lot.id, after)))
            .orderBy(asc(lot.id))
            .limit(limit);
          if (lots.length === 0) return [];
          const lotIds = lots.map((row) => row.id);

          const payments = await db
            .select({
              id: payment.id,
              lotId: payment.lotId,
              amount: payment.amount,
              createdAt: payment.createdAt,
            })
            .from(payment)
            .where(
              and(
                inArray(payment.lotId, lotIds),
                eq(payment.buyerId, s),
                ne(payment.status, "cancelled"),
              ),
            );
          const fulfilments = await db
            .select({
              lotId: lotFulfilment.lotId,
              method: lotFulfilment.fulfilmentMethod,
              status: lotFulfilment.status,
              carrier: lotFulfilment.shippingCarrier,
              trackingNumber: lotFulfilment.trackingNumber,
              collectedAt: lotFulfilment.collectedAt,
            })
            .from(lotFulfilment)
            .where(inArray(lotFulfilment.lotId, lotIds));
          const paymentIds = payments.map((row) => row.id);
          const disputes =
            paymentIds.length === 0
              ? []
              : await db
                  .select({
                    paymentId: disputeCaseCandidate.paymentId,
                    id: disputeCase.id,
                    status: disputeCase.status,
                    reason: disputeCase.reason,
                    amountPence: disputeCase.amountPence,
                    currency: disputeCase.currency,
                    openedAt: disputeCase.stripeCreatedAt,
                    closedAt: disputeCase.closedAt,
                  })
                  .from(disputeCaseCandidate)
                  .innerJoin(disputeCase, eq(disputeCase.id, disputeCaseCandidate.caseId))
                  .where(inArray(disputeCaseCandidate.paymentId, paymentIds));

          return lots.map((row) => {
            const invoice = payments.find((p) => p.lotId === row.id) ?? null;
            const fulfilment = fulfilments.find((f) => f.lotId === row.id) ?? null;
            return {
              key: row.id,
              record: mapPurchase(
                {
                  lot: row,
                  sale:
                    row.saleId && row.saleTitle ? { id: row.saleId, title: row.saleTitle } : null,
                  invoice,
                  fulfilment,
                  disputes: disputes.filter((d) => d.paymentId === invoice?.id),
                },
                webOrigin,
              ),
            };
          });
        },
      },
    ];
  }
}
