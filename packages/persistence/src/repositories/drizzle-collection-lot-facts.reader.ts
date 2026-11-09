import type { Database } from "@auction/db";
import {
  bidUserProfile,
  collectionBookingLot,
  deliveryQuote,
  disputeCase,
  disputeCaseCandidate,
  legalEntity,
  lot,
  lotFulfilment,
  payment,
  paymentRefundReconcile,
  sale,
  sourceOfFunds,
} from "@auction/db/schema";
import {
  type CollectionCheck,
  type CollectionFulfilment,
  type CollectionLotFacts,
  decisivePayment,
} from "@auction/domain";
import { and, asc, desc, eq, inArray, isNotNull, isNull, notExists, or } from "drizzle-orm";
import type {
  CollectionLotRecord,
  ICollectionLotFactsReader,
} from "../interfaces/collection-lot-facts.reader.js";

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/** How a lot's fulfilment record reads to collection: ended, handed over, or going by courier. */
function fulfilmentOf(
  record: { status: string; method: string | null } | undefined,
  quoteAccepted: boolean,
): CollectionFulfilment {
  if (record?.status === "cancelled") return "cancelled";
  if (record?.status === "delivered" && record.method === "collection") return "collected";
  if (record?.method === "shipping" || quoteAccepted) return "courier";
  return "none";
}

export class DrizzleCollectionLotFactsReader implements ICollectionLotFactsReader {
  constructor(private readonly db: Database) {}

  async lotIdsForBuyer(legalEntityId: string, venueId: string, limit: number): Promise<string[]> {
    // Only real candidates are asked for, so the limit never cuts one off: lots already handed
    // over, ended, on their way by courier or in a live booking are left out in the query, and the
    // newest lots come first.
    const rows = await this.db
      .select({ id: lot.id })
      .from(lot)
      .innerJoin(sale, eq(sale.id, lot.saleId))
      .where(
        and(
          eq(lot.buyerLegalEntityId, legalEntityId),
          eq(lot.status, "ended"),
          isNotNull(lot.winnerId),
          eq(sale.venueId, venueId),
          notExists(
            this.db
              .select({ one: lotFulfilment.lotId })
              .from(lotFulfilment)
              .where(
                and(
                  eq(lotFulfilment.lotId, lot.id),
                  or(
                    inArray(lotFulfilment.status, ["delivered", "cancelled", "in_transit"]),
                    eq(lotFulfilment.fulfilmentMethod, "shipping"),
                  ),
                ),
              ),
          ),
          notExists(
            this.db
              .select({ one: collectionBookingLot.lotId })
              .from(collectionBookingLot)
              .where(
                and(eq(collectionBookingLot.lotId, lot.id), eq(collectionBookingLot.active, true)),
              ),
          ),
        ),
      )
      .orderBy(desc(lot.endTime), asc(lot.lotNumber), asc(lot.id))
      .limit(limit);
    return rows.map((row) => row.id);
  }

  async read(lotIds: readonly string[]): Promise<Map<string, CollectionLotRecord>> {
    const ids = unique(lotIds);
    if (ids.length === 0) return new Map();

    const lots = await this.db
      .select({
        id: lot.id,
        title: lot.title,
        lotNumber: lot.lotNumber,
        winnerId: lot.winnerId,
        buyerLegalEntityId: lot.buyerLegalEntityId,
        venueId: sale.venueId,
        buyerKind: legalEntity.kind,
        buyerStatus: legalEntity.status,
      })
      .from(lot)
      .leftJoin(sale, eq(sale.id, lot.saleId))
      .leftJoin(legalEntity, eq(legalEntity.id, lot.buyerLegalEntityId))
      .where(and(inArray(lot.id, ids), eq(lot.status, "ended")));
    const won = lots.filter((row) => row.winnerId !== null);
    if (won.length === 0) return new Map();
    const wonIds = won.map((row) => row.id);
    const winners = unique(won.map((row) => row.winnerId as string));

    const [payments, fulfilments, quotes, bookedLots, sofCases, amlHolds] = await Promise.all([
      this.db
        .select({ id: payment.id, lotId: payment.lotId, status: payment.status })
        .from(payment)
        .where(inArray(payment.lotId, wonIds))
        .orderBy(desc(payment.createdAt)),
      this.db
        .select({
          lotId: lotFulfilment.lotId,
          status: lotFulfilment.status,
          method: lotFulfilment.fulfilmentMethod,
        })
        .from(lotFulfilment)
        .where(inArray(lotFulfilment.lotId, wonIds)),
      this.db
        .select({ lotId: deliveryQuote.lotId })
        .from(deliveryQuote)
        .where(and(inArray(deliveryQuote.lotId, wonIds), eq(deliveryQuote.status, "accepted"))),
      this.db
        .select({ lotId: collectionBookingLot.lotId, bookingId: collectionBookingLot.bookingId })
        .from(collectionBookingLot)
        .where(
          and(inArray(collectionBookingLot.lotId, wonIds), eq(collectionBookingLot.active, true)),
        ),
      this.db
        .select({ userId: sourceOfFunds.userId })
        .from(sourceOfFunds)
        .where(and(inArray(sourceOfFunds.userId, winners), eq(sourceOfFunds.status, "pending"))),
      this.db
        .select({ userId: bidUserProfile.userId, hold: bidUserProfile.amlHoldStatus })
        .from(bidUserProfile)
        .where(inArray(bidUserProfile.userId, winners)),
    ]);

    const paymentIds = payments.map((row) => row.id);
    const [disputes, refunds] =
      paymentIds.length === 0
        ? [[], []]
        : await Promise.all([
            this.db
              .select({ paymentId: disputeCaseCandidate.paymentId })
              .from(disputeCaseCandidate)
              .innerJoin(disputeCase, eq(disputeCase.id, disputeCaseCandidate.caseId))
              .where(
                and(
                  inArray(disputeCaseCandidate.paymentId, paymentIds),
                  isNull(disputeCase.closedAt),
                ),
              ),
            this.db
              .select({ paymentId: paymentRefundReconcile.paymentId })
              .from(paymentRefundReconcile)
              .where(
                and(
                  inArray(paymentRefundReconcile.paymentId, paymentIds),
                  isNull(paymentRefundReconcile.reconciledAt),
                ),
              ),
          ]);

    const paymentsByLot = new Map<string, typeof payments>();
    for (const row of payments) {
      paymentsByLot.set(row.lotId, [...(paymentsByLot.get(row.lotId) ?? []), row]);
    }
    const fulfilmentByLot = new Map(fulfilments.map((row) => [row.lotId, row]));
    const quoted = new Set(quotes.map((row) => row.lotId));
    const bookingByLot = new Map(bookedLots.map((row) => [row.lotId, row.bookingId]));
    const sofUsers = new Set(sofCases.map((row) => row.userId));
    const heldUsers = new Set(
      amlHolds.filter((row) => row.hold !== "none").map((row) => row.userId),
    );
    const disputedPayments = new Set(disputes.map((row) => row.paymentId));
    const refundingPayments = new Set(refunds.map((row) => row.paymentId));

    return new Map(
      won.map((row) => {
        const attempts = paymentsByLot.get(row.id) ?? [];
        const deciding = decisivePayment(attempts);
        const winnerId = row.winnerId as string;
        const checks: CollectionCheck[] = [];
        if (heldUsers.has(winnerId)) checks.push("identity");
        if (sofUsers.has(winnerId)) checks.push("source_of_funds");
        if (deciding?.status === "requires_manual_review") checks.push("finance");
        const facts: CollectionLotFacts = {
          paymentCleared: deciding?.status === "captured",
          openChecks: checks,
          organisationStatus: row.buyerKind === "organisation" ? (row.buyerStatus ?? null) : null,
          disputeOpen: deciding ? disputedPayments.has(deciding.id) : false,
          refunded: deciding?.status === "refunded",
          refundOpen: deciding ? refundingPayments.has(deciding.id) : false,
          fulfilment: fulfilmentOf(fulfilmentByLot.get(row.id), quoted.has(row.id)),
          activeBookingId: bookingByLot.get(row.id) ?? null,
        };
        return [
          row.id,
          {
            lotId: row.id,
            title: row.title,
            lotNumber: row.lotNumber,
            buyerLegalEntityId: row.buyerLegalEntityId,
            buyerAccountKind: row.buyerKind ?? null,
            winnerId,
            venueId: row.venueId ?? null,
            facts,
          },
        ];
      }),
    );
  }
}
