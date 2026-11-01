import { type Database, lotNotDeleted } from "@auction/db";
import { absenteeBid, bid, lot, payment, saleRegistration } from "@auction/db/schema";
import { and, desc, eq, inArray, max, sql } from "drizzle-orm";
import type {
  ILotViewerFactsReader,
  LotViewerFactsQuery,
  LotViewerRawFacts,
} from "../interfaces/lot-viewer-facts.reader.js";

const money = (value: string | null | undefined): string | null => (value == null ? null : value);

function greater(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return Number.parseFloat(a) >= Number.parseFloat(b) ? a : b;
}

/**
 * One account's standing on a set of lots, in one query per fact (lots, the account's bids,
 * its scheduled absentee bids, its registrations, its invoices), never one per lot.
 */
export class DrizzleLotViewerFactsReader implements ILotViewerFactsReader {
  constructor(private readonly db: Database) {}

  async load(query: LotViewerFactsQuery): Promise<LotViewerRawFacts[]> {
    const lotIds = [...new Set(query.lotIds)];
    if (lotIds.length === 0) return [];
    const { userId, legalEntityId } = query;

    const lots = await this.db
      .select({
        id: lot.id,
        saleId: lot.saleId,
        status: lot.status,
        auctionType: lot.auctionType,
        currentPrice: lot.currentPrice,
        startingPrice: lot.startingPrice,
        minBidIncrement: lot.minBidIncrement,
        winnerId: lot.winnerId,
        buyerLegalEntityId: lot.buyerLegalEntityId,
      })
      .from(lot)
      .where(and(inArray(lot.id, lotIds), lotNotDeleted()));
    if (lots.length === 0) return [];
    const foundIds = lots.map((row) => row.id);
    const saleIds = [...new Set(lots.flatMap((row) => (row.saleId ? [row.saleId] : [])))];

    const [bids, absentees, registrations, payments] = await Promise.all([
      this.db
        .select({
          lotId: bid.lotId,
          highest: max(bid.amount),
          ceiling: max(bid.maxAutoBidAmount),
          leading: sql<boolean>`bool_or(${bid.isWinning})`,
        })
        .from(bid)
        .where(and(inArray(bid.lotId, foundIds), eq(bid.buyerLegalEntityId, legalEntityId)))
        .groupBy(bid.lotId),
      this.db
        .select({ lotId: absenteeBid.lotId, ceiling: max(absenteeBid.maxAmount) })
        .from(absenteeBid)
        .where(
          and(
            inArray(absenteeBid.lotId, foundIds),
            eq(absenteeBid.buyerLegalEntityId, legalEntityId),
            eq(absenteeBid.status, "scheduled"),
          ),
        )
        .groupBy(absenteeBid.lotId),
      saleIds.length === 0
        ? Promise.resolve([] as { saleId: string; status: LotViewerRawFacts["registration"] }[])
        : this.db
            .select({ saleId: saleRegistration.saleId, status: saleRegistration.status })
            .from(saleRegistration)
            .where(
              and(
                inArray(saleRegistration.saleId, saleIds),
                eq(saleRegistration.userId, userId),
                eq(saleRegistration.buyerLegalEntityId, legalEntityId),
              ),
            ),
      this.db
        .select({
          id: payment.id,
          lotId: payment.lotId,
          status: payment.status,
          raisedAt: payment.createdAt,
        })
        .from(payment)
        .where(and(inArray(payment.lotId, foundIds), eq(payment.buyerLegalEntityId, legalEntityId)))
        .orderBy(desc(payment.createdAt)),
    ]);

    const bidByLot = new Map(bids.map((row) => [row.lotId, row]));
    const absenteeByLot = new Map(absentees.map((row) => [row.lotId, row.ceiling]));
    const registrationBySale = new Map(registrations.map((row) => [row.saleId, row.status]));
    const paymentByLot = new Map<string, LotViewerRawFacts["payment"]>();
    for (const row of payments) {
      if (!paymentByLot.has(row.lotId)) {
        paymentByLot.set(row.lotId, {
          id: row.id,
          status: row.status,
          raisedAt: row.raisedAt,
        });
      }
    }

    return lots.map((row) => {
      const mine = bidByLot.get(row.id);
      const wonByAccount =
        row.status === "ended" &&
        (row.buyerLegalEntityId === legalEntityId ||
          (row.buyerLegalEntityId === null && row.winnerId === userId));
      return {
        lotId: row.id,
        saleId: row.saleId,
        lotStatus: row.status,
        auctionType: row.auctionType,
        currentPrice: row.currentPrice,
        startingPrice: row.startingPrice,
        minBidIncrement: row.minBidIncrement,
        registration: row.saleId ? (registrationBySale.get(row.saleId) ?? null) : null,
        leading: Boolean(mine?.leading) && row.status !== "ended",
        won: wonByAccount,
        hasBid: mine !== undefined,
        highestBid: money(mine?.highest),
        maxBid: greater(money(mine?.ceiling), money(absenteeByLot.get(row.id))),
        payment: wonByAccount ? (paymentByLot.get(row.id) ?? null) : null,
      };
    });
  }
}
