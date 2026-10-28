import type { Database } from "@auction/db";
import { absenteeBid, bid, bidIdentityDirectory, legalEntityMember, lot } from "@auction/db/schema";
import { and, desc, eq, isNotNull, max, notExists, or, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { DbTransaction } from "../interfaces/artist-delete.repository.js";
import type {
  FormerMemberBidRef,
  FormerMemberOpenBid,
  IFormerMemberBidsRepository,
} from "../interfaces/former-member-bids.repository.js";

type Connection = Database | DbTransaction;

/** True when `userColumn` has no active membership in the organisation. */
function notActiveMember(legalEntityId: string, userColumn: AnyPgColumn) {
  return (db: Connection) =>
    notExists(
      db
        .select({ one: sql`1` })
        .from(legalEntityMember)
        .where(
          and(
            eq(legalEntityMember.legalEntityId, legalEntityId),
            eq(legalEntityMember.userId, userColumn),
            sql`${legalEntityMember.removedAt} IS NULL`,
          ),
        ),
    );
}

const PROXY_MAX = or(isNotNull(bid.maxAutoBidAmount), eq(bid.isAutoBid, true));

/**
 * Auto-bid maximums on live lots and scheduled absentee bids that people who left an organisation
 * placed for it. Removal does not cancel them; owners and admins choose to.
 */
export class DrizzleFormerMemberBidsRepository implements IFormerMemberBidsRepository {
  constructor(private readonly db: Database) {}

  listForEntity(legalEntityId: string): Promise<FormerMemberOpenBid[]> {
    return this.list(this.db, legalEntityId, null);
  }

  listForMember(legalEntityId: string, memberUserId: string): Promise<FormerMemberOpenBid[]> {
    return this.list(this.db, legalEntityId, memberUserId);
  }

  async cancel(
    tx: DbTransaction,
    legalEntityId: string,
    ref: FormerMemberBidRef,
    reason: string,
  ): Promise<FormerMemberOpenBid | null> {
    const open = await this.list(tx, legalEntityId, ref.memberUserId);
    const target = open.find((row) => row.kind === ref.kind && row.id === ref.id);
    if (!target) return null;
    if (target.kind === "absentee") {
      const updated = await tx
        .update(absenteeBid)
        .set({ status: "cancelled", cancelledAt: new Date(), cancellationReason: reason })
        .where(and(eq(absenteeBid.id, target.id), eq(absenteeBid.status, "scheduled")))
        .returning({ id: absenteeBid.id });
      return updated.length > 0 ? target : null;
    }
    const updated = await tx
      .update(bid)
      .set({ maxAutoBidAmount: null, isAutoBid: false, autoBidStepAmount: null })
      .where(
        and(
          eq(bid.lotId, target.lotId),
          eq(bid.bidderId, target.memberUserId),
          eq(bid.buyerLegalEntityId, legalEntityId),
          PROXY_MAX,
        ),
      )
      .returning({ id: bid.id });
    return updated.length > 0 ? target : null;
  }

  private async list(
    db: Connection,
    legalEntityId: string,
    memberUserId: string | null,
  ): Promise<FormerMemberOpenBid[]> {
    const [autoBids, absentee] = await Promise.all([
      this.listAutoBids(db, legalEntityId, memberUserId),
      this.listAbsentee(db, legalEntityId, memberUserId),
    ]);
    return [...autoBids, ...absentee].sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime());
  }

  private async listAutoBids(
    db: Connection,
    legalEntityId: string,
    memberUserId: string | null,
  ): Promise<FormerMemberOpenBid[]> {
    const rows = await db
      .select({
        lotId: lot.id,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
        endsAt: lot.endTime,
        memberUserId: bid.bidderId,
        memberName: bidIdentityDirectory.name,
        maxAmount: max(bid.maxAutoBidAmount),
      })
      .from(bid)
      .innerJoin(lot, eq(lot.id, bid.lotId))
      .leftJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, bid.bidderId))
      .where(
        and(
          eq(bid.buyerLegalEntityId, legalEntityId),
          eq(lot.status, "active"),
          PROXY_MAX,
          memberUserId ? eq(bid.bidderId, memberUserId) : undefined,
          notActiveMember(legalEntityId, bid.bidderId)(db),
        ),
      )
      .groupBy(lot.id, bid.bidderId, bidIdentityDirectory.name)
      .orderBy(desc(lot.endTime));
    return rows
      .filter((row) => row.maxAmount !== null)
      .map((row) => ({
        kind: "auto_bid" as const,
        id: row.lotId,
        lotId: row.lotId,
        lotTitle: row.lotTitle,
        lotNumber: row.lotNumber,
        endsAt: row.endsAt,
        memberUserId: row.memberUserId,
        memberName: row.memberName ?? "Former member",
        maxAmount: String(row.maxAmount),
      }));
  }

  private async listAbsentee(
    db: Connection,
    legalEntityId: string,
    memberUserId: string | null,
  ): Promise<FormerMemberOpenBid[]> {
    const rows = await db
      .select({
        id: absenteeBid.id,
        lotId: lot.id,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
        endsAt: lot.endTime,
        memberUserId: absenteeBid.userId,
        memberName: bidIdentityDirectory.name,
        maxAmount: absenteeBid.maxAmount,
      })
      .from(absenteeBid)
      .innerJoin(lot, eq(lot.id, absenteeBid.lotId))
      .leftJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, absenteeBid.userId))
      .where(
        and(
          eq(absenteeBid.buyerLegalEntityId, legalEntityId),
          eq(absenteeBid.status, "scheduled"),
          memberUserId ? eq(absenteeBid.userId, memberUserId) : undefined,
          notActiveMember(legalEntityId, absenteeBid.userId)(db),
        ),
      );
    return rows.map((row) => ({
      kind: "absentee" as const,
      id: row.id,
      lotId: row.lotId,
      lotTitle: row.lotTitle,
      lotNumber: row.lotNumber,
      endsAt: row.endsAt,
      memberUserId: row.memberUserId,
      memberName: row.memberName ?? "Former member",
      maxAmount: String(row.maxAmount),
    }));
  }
}
