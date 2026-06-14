import type { Database } from "@auction/db";
import { bid, lot } from "@auction/db/schema";
import type { InferSelectModel } from "drizzle-orm";
import { and, asc, desc, eq, isNotNull, or, sql } from "drizzle-orm";
import { mapBidRow } from "../lib/mappers.js";
import type { CreateBidRow, IBidRepository } from "../services/interfaces/repositories.js";

function rowsFromExecute(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === "object" && "rows" in result) {
    return (result as { rows?: Record<string, unknown>[] }).rows ?? [];
  }
  return [];
}

export class DrizzleBidRepository implements IBidRepository {
  constructor(private readonly db: Database) {}

  async create(row: CreateBidRow) {
    const [created] = await this.db
      .insert(bid)
      .values({
        lotId: row.lotId,
        bidderId: row.placedByUserId,
        buyerLegalEntityId: row.buyerLegalEntityId,
        amount: row.amount,
        isWinning: row.isWinning,
        isAutoBid: row.isAutoBid,
        maxAutoBidAmount: row.maxAutoBidAmount,
        autoBidStepAmount: row.autoBidStepAmount ?? null,
        placedVia: row.placedVia ?? null,
        telephoneBookingId: row.telephoneBookingId ?? null,
        clerkUserId: row.clerkUserId ?? null,
      })
      .returning();
    if (!created) throw new Error("Failed to create bid");
    return mapBidRow(created);
  }

  async findHighestForLot(lotId: string) {
    const rows = await this.db
      .select()
      .from(bid)
      .where(eq(bid.lotId, lotId))
      .orderBy(desc(bid.amount))
      .limit(1);
    const row = rows[0];
    return row ? mapBidRow(row) : null;
  }

  async listForLot(lotId: string, limit: number) {
    const rows = await this.db
      .select()
      .from(bid)
      .where(eq(bid.lotId, lotId))
      .orderBy(desc(bid.createdAt))
      .limit(limit);
    return rows.map(mapBidRow);
  }

  async listForLotSettlement(lotId: string, limit: number) {
    const rows = await this.db
      .select()
      .from(bid)
      .where(eq(bid.lotId, lotId))
      .orderBy(desc(bid.amount), asc(bid.createdAt))
      .limit(limit);
    return rows.map(mapBidRow);
  }

  async findEligibleBidsForLotClose(
    lotId: string,
    params: {
      sellerLegalEntityId: string | null;
      reservePrice: string | null;
      sort: "english" | "dutch";
    },
  ) {
    const reserveClause =
      params.reservePrice && params.reservePrice.trim() !== ""
        ? sql`AND b.amount::numeric >= ${params.reservePrice.trim()}::numeric`
        : sql``;

    const antiClause = params.sellerLegalEntityId
      ? sql`AND NOT EXISTS (
          SELECT 1 FROM legal_entity_member lem
          WHERE lem.legal_entity_id = ${params.sellerLegalEntityId}::uuid
            AND lem.user_id = b.bidder_id
            AND lem.removed_at IS NULL
            AND lem.accepted_at IS NOT NULL
        )
        AND b.buyer_legal_entity_id <> ${params.sellerLegalEntityId}::uuid
        AND NOT EXISTS (
          SELECT 1 FROM legal_entity_member mbuy
          INNER JOIN legal_entity_member msel ON mbuy.user_id = msel.user_id
          WHERE mbuy.legal_entity_id = b.buyer_legal_entity_id
            AND msel.legal_entity_id = ${params.sellerLegalEntityId}::uuid
            AND mbuy.removed_at IS NULL
            AND msel.removed_at IS NULL
            AND mbuy.accepted_at IS NOT NULL
            AND msel.accepted_at IS NOT NULL
        )`
      : sql``;

    const orderClause =
      params.sort === "dutch"
        ? sql`ORDER BY b.created_at ASC`
        : sql`ORDER BY b.amount::numeric DESC, b.created_at ASC`;

    const res = await this.db.execute(sql`
      SELECT
        b.id,
        b.lot_id AS "lotId",
        b.bidder_id AS "bidderId",
        b.buyer_legal_entity_id AS "buyerLegalEntityId",
        b.amount,
        b.is_winning AS "isWinning",
        b.is_auto_bid AS "isAutoBid",
        b.max_auto_bid_amount AS "maxAutoBidAmount",
        b.created_at AS "createdAt"
      FROM bid b
      WHERE b.lot_id = ${lotId}::uuid
      ${reserveClause}
      ${antiClause}
      ${orderClause}
      LIMIT 50
    `);

    const rawRows = rowsFromExecute(res);
    return rawRows.map((row) => {
      const typed = row as Record<string, unknown>;
      return mapBidRow({
        id: String(typed.id),
        lotId: String(typed.lotId),
        bidderId: String(typed.bidderId),
        buyerLegalEntityId: String(typed.buyerLegalEntityId),
        amount: typed.amount,
        isWinning: Boolean(typed.isWinning),
        isAutoBid: Boolean(typed.isAutoBid),
        maxAutoBidAmount: typed.maxAutoBidAmount ?? null,
        createdAt:
          typed.createdAt instanceof Date ? typed.createdAt : new Date(String(typed.createdAt)),
      } as InferSelectModel<typeof bid>);
    });
  }

  async findWinningBid(lotId: string) {
    const rows = await this.db
      .select()
      .from(bid)
      .where(and(eq(bid.lotId, lotId), eq(bid.isWinning, true)))
      .orderBy(desc(bid.amount), asc(bid.createdAt))
      .limit(1);
    const row = rows[0];
    return row ? mapBidRow(row) : null;
  }

  async aggregateBidderCeilings(lotId: string): Promise<Map<string, number>> {
    const rows = await this.db
      .select({
        bidderId: bid.bidderId,
        ceiling:
          sql<string>`max(greatest(${bid.amount}::numeric, coalesce(${bid.maxAutoBidAmount}::numeric, ${bid.amount}::numeric)))`.as(
            "ceiling",
          ),
      })
      .from(bid)
      .where(eq(bid.lotId, lotId))
      .groupBy(bid.bidderId);
    const m = new Map<string, number>();
    for (const r of rows) {
      m.set(r.bidderId, Number(r.ceiling));
    }
    return m;
  }

  async listBidderCeilingStates(lotId: string): Promise<
    Array<{
      bidderId: string;
      buyerLegalEntityId: string;
      ceiling: string;
      autoBidStepAmount: string | null;
      maxCreatedAt: Date | null;
    }>
  > {
    const res = await this.db.execute(sql`
      SELECT DISTINCT ON (bidder_id)
        bidder_id AS "bidderId",
        buyer_legal_entity_id AS "buyerLegalEntityId",
        (greatest(amount::numeric, coalesce(max_auto_bid_amount::numeric, amount::numeric)))::text AS ceiling,
        auto_bid_step_amount::text AS "autoBidStepAmount",
        COALESCE(
          (
            SELECT MIN(b2.created_at)
            FROM bid b2
            WHERE b2.lot_id = ${lotId}::uuid
              AND b2.bidder_id = bid.bidder_id
              AND b2.max_auto_bid_amount IS NOT NULL
          ),
          (
            SELECT MIN(b3.created_at)
            FROM bid b3
            WHERE b3.lot_id = ${lotId}::uuid
              AND b3.bidder_id = bid.bidder_id
          )
        ) AS "maxCreatedAt"
      FROM bid
      WHERE lot_id = ${lotId}::uuid
      ORDER BY bidder_id,
        greatest(amount::numeric, coalesce(max_auto_bid_amount::numeric, amount::numeric)) DESC,
        created_at DESC
    `);
    return rowsFromExecute(res).map((row) => ({
      bidderId: String(row.bidderId),
      buyerLegalEntityId: String(row.buyerLegalEntityId),
      ceiling: String(row.ceiling),
      autoBidStepAmount:
        row.autoBidStepAmount == null || row.autoBidStepAmount === ""
          ? null
          : String(row.autoBidStepAmount),
      maxCreatedAt:
        row.maxCreatedAt == null
          ? null
          : row.maxCreatedAt instanceof Date
            ? row.maxCreatedAt
            : new Date(String(row.maxCreatedAt)),
    }));
  }

  async updateProxySettingsForBidderOnLot(
    lotId: string,
    bidderId: string,
    settings: { maxAutoBidAmount: string; autoBidStepAmount: string },
  ): Promise<number> {
    const updated = await this.db
      .update(bid)
      .set({
        maxAutoBidAmount: settings.maxAutoBidAmount,
        autoBidStepAmount: settings.autoBidStepAmount,
        isAutoBid: true,
      })
      .where(and(eq(bid.lotId, lotId), eq(bid.bidderId, bidderId)))
      .returning({ id: bid.id });
    return updated.length;
  }

  async findProxySettingsForBidderOnLot(lotId: string, bidderId: string) {
    const rows = await this.db
      .select({
        maxAutoBidAmount: bid.maxAutoBidAmount,
        autoBidStepAmount: bid.autoBidStepAmount,
        createdAt: bid.createdAt,
      })
      .from(bid)
      .where(
        and(
          eq(bid.lotId, lotId),
          eq(bid.bidderId, bidderId),
          or(isNotNull(bid.maxAutoBidAmount), eq(bid.isAutoBid, true)),
        ),
      )
      .orderBy(desc(bid.createdAt))
      .limit(1);
    const row = rows[0];
    if (!row?.maxAutoBidAmount) return null;
    return {
      maxAutoBidAmount: String(row.maxAutoBidAmount),
      autoBidStepAmount: row.autoBidStepAmount != null ? String(row.autoBidStepAmount) : null,
    };
  }

  async bidderHasProxyMaxOnLot(lotId: string, bidderId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: bid.id })
      .from(bid)
      .where(and(eq(bid.lotId, lotId), eq(bid.bidderId, bidderId), isNotNull(bid.maxAutoBidAmount)))
      .limit(1);
    return rows.length > 0;
  }

  async clearProxyAutoBidForBidderOnLot(lotId: string, bidderId: string): Promise<number> {
    const updated = await this.db
      .update(bid)
      .set({ maxAutoBidAmount: null, isAutoBid: false, autoBidStepAmount: null })
      .where(
        and(
          eq(bid.lotId, lotId),
          eq(bid.bidderId, bidderId),
          or(isNotNull(bid.maxAutoBidAmount), eq(bid.isAutoBid, true)),
        ),
      )
      .returning({ id: bid.id });
    return updated.length;
  }

  async listActiveProxyBidPairsForBuyerEntity(
    buyerLegalEntityId: string,
  ): Promise<{ lotId: string; bidderId: string }[]> {
    const rows = await this.db
      .selectDistinct({ lotId: bid.lotId, bidderId: bid.bidderId })
      .from(bid)
      .innerJoin(lot, eq(lot.id, bid.lotId))
      .where(
        and(
          eq(bid.buyerLegalEntityId, buyerLegalEntityId),
          eq(lot.status, "active"),
          or(isNotNull(bid.maxAutoBidAmount), eq(bid.isAutoBid, true)),
        ),
      );
    return rows.map((r) => ({ lotId: r.lotId, bidderId: r.bidderId }));
  }

  async listActiveProxyBidPairsForMemberOnEntity(
    placedByUserId: string,
    buyerLegalEntityId: string,
  ): Promise<{ lotId: string; bidderId: string }[]> {
    const rows = await this.db
      .selectDistinct({ lotId: bid.lotId, bidderId: bid.bidderId })
      .from(bid)
      .innerJoin(lot, eq(lot.id, bid.lotId))
      .where(
        and(
          eq(bid.buyerLegalEntityId, buyerLegalEntityId),
          eq(bid.bidderId, placedByUserId),
          eq(lot.status, "active"),
          or(isNotNull(bid.maxAutoBidAmount), eq(bid.isAutoBid, true)),
        ),
      );
    return rows.map((r) => ({ lotId: r.lotId, bidderId: r.bidderId }));
  }

  async listDistinctBidderIds(lotId: string) {
    const rows = await this.db
      .selectDistinct({ bidderId: bid.bidderId })
      .from(bid)
      .where(eq(bid.lotId, lotId));
    return rows.map((r) => r.bidderId);
  }

  async listForBidder(bidderId: string, limit: number) {
    const rows = await this.db
      .select()
      .from(bid)
      .where(eq(bid.bidderId, bidderId))
      .orderBy(desc(bid.createdAt))
      .limit(limit);
    return rows.map(mapBidRow);
  }

  async markWinningBid(lotId: string, bidId: string) {
    await this.db.execute(sql`
      UPDATE bid
      SET is_winning = (id = ${bidId}::uuid)
      WHERE lot_id = ${lotId}::uuid
        AND (is_winning = true OR id = ${bidId}::uuid)
    `);
  }
}
