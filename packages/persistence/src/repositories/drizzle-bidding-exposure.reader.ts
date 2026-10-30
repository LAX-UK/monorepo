import { type Database, lotNotDeleted } from "@auction/db";
import { absenteeBid, bid, lot, payment } from "@auction/db/schema";
import { and, eq, exists, gt, inArray, isNotNull, not, or, sql } from "drizzle-orm";
import type {
  BiddingExposureCommitmentRow,
  IBiddingExposureLock,
  IBiddingExposureReader,
} from "../interfaces/bidding-limits.repository.js";

/** Lots a bid can still change: the commitment on them is open. */
const OPEN_LOT_STATUSES = ["scheduled", "active"] as const;
/** A won lot stops counting once paid for (or paid and then refunded, which ends the sale). */
const SETTLED_PAYMENTS = ["captured", "refunded"] as const;

/**
 * Reads an organisation's open commitments for its bidding limits, and serialises the bids
 * checked against them. Every query runs on `conn` when given, so the bid transaction reads
 * what other bids committed before it took the lock.
 */
export class DrizzleBiddingExposureReader implements IBiddingExposureReader, IBiddingExposureLock {
  constructor(private readonly db: Database) {}

  async lockForLegalEntity(tx: Database, legalEntityId: string): Promise<void> {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`bidding_limit:${legalEntityId}`}))`,
    );
  }

  async listCommitments(
    legalEntityId: string,
    conn: Database = this.db,
  ): Promise<BiddingExposureCommitmentRow[]> {
    const leading = await conn
      .select({ lotId: bid.lotId, saleId: lot.saleId, userId: bid.bidderId, amount: bid.amount })
      .from(bid)
      .innerJoin(lot, eq(lot.id, bid.lotId))
      .where(
        and(
          eq(bid.buyerLegalEntityId, legalEntityId),
          eq(bid.isWinning, true),
          inArray(lot.status, [...OPEN_LOT_STATUSES]),
          lotNotDeleted(),
        ),
      );

    // A maximum still counts while it can bid: it leads, or it is above the current price.
    const maximums = await conn
      .select({
        lotId: bid.lotId,
        saleId: lot.saleId,
        userId: bid.bidderId,
        amount: bid.maxAutoBidAmount,
      })
      .from(bid)
      .innerJoin(lot, eq(lot.id, bid.lotId))
      .where(
        and(
          eq(bid.buyerLegalEntityId, legalEntityId),
          isNotNull(bid.maxAutoBidAmount),
          or(eq(bid.isWinning, true), gt(bid.maxAutoBidAmount, lot.currentPrice)),
          inArray(lot.status, [...OPEN_LOT_STATUSES]),
          lotNotDeleted(),
        ),
      );

    const absentees = await conn
      .select({
        lotId: absenteeBid.lotId,
        saleId: lot.saleId,
        userId: absenteeBid.userId,
        amount: absenteeBid.maxAmount,
      })
      .from(absenteeBid)
      .innerJoin(lot, eq(lot.id, absenteeBid.lotId))
      .where(
        and(
          eq(absenteeBid.buyerLegalEntityId, legalEntityId),
          eq(absenteeBid.status, "scheduled"),
          inArray(lot.status, [...OPEN_LOT_STATUSES]),
          lotNotDeleted(),
        ),
      );

    const unpaidWins = await conn
      .select({ lotId: lot.id, saleId: lot.saleId, userId: lot.winnerId, amount: lot.currentPrice })
      .from(lot)
      .where(
        and(
          eq(lot.buyerLegalEntityId, legalEntityId),
          eq(lot.status, "ended"),
          isNotNull(lot.winnerId),
          lotNotDeleted(),
          not(
            exists(
              conn
                .select({ one: sql`1` })
                .from(payment)
                .where(
                  and(eq(payment.lotId, lot.id), inArray(payment.status, [...SETTLED_PAYMENTS])),
                ),
            ),
          ),
        ),
      );

    return [
      ...leading.map((r) => ({ ...r, kind: "leading_bid" as const })),
      ...maximums.map((r) => ({ ...r, kind: "maximum_bid" as const })),
      ...absentees.map((r) => ({ ...r, kind: "absentee_bid" as const })),
      ...unpaidWins.map((r) => ({ ...r, kind: "unpaid_win" as const })),
    ].flatMap((r) =>
      r.userId != null && r.amount != null
        ? [{ ...r, userId: r.userId, amount: String(r.amount) }]
        : [],
    );
  }
}
