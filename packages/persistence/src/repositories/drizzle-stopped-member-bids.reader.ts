import type { Database } from "@auction/db";
import { bidIdentityDirectory, domainEvent } from "@auction/db/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type {
  IStoppedMemberBidsReader,
  StoppedMemberBid,
  StoppedMemberBids,
} from "../interfaces/stopped-member-bids.reader.js";

const EVENT_TYPE = "legal_entity.member_bid_stopped";
/** Bids stopped by one removal are recorded together; a minute apart means another removal. */
const SAME_REMOVAL_MS = 60_000;

type Payload = {
  bid_kind?: unknown;
  lot_id?: unknown;
  lot_title?: unknown;
  lot_number?: unknown;
  max_amount?: unknown;
  member_user_id?: unknown;
};

function toBid(payload: Payload): StoppedMemberBid | null {
  const kind = payload.bid_kind;
  if ((kind !== "auto_bid" && kind !== "absentee") || typeof payload.lot_id !== "string") {
    return null;
  }
  return {
    kind,
    lotId: payload.lot_id,
    lotTitle: typeof payload.lot_title === "string" ? payload.lot_title : "A lot",
    lotNumber: typeof payload.lot_number === "number" ? payload.lot_number : null,
    maxAmount: typeof payload.max_amount === "string" ? payload.max_amount : "0",
  };
}

/** Reads the audit entries written when a removal stopped a member's automatic bids. */
export class DrizzleStoppedMemberBidsReader implements IStoppedMemberBidsReader {
  constructor(private readonly db: Database) {}

  async listSince(legalEntityId: string, since: Date): Promise<StoppedMemberBids[]> {
    const rows = await this.db
      .select({
        payload: domainEvent.payload,
        occurredAt: domainEvent.occurredAt,
        memberName: bidIdentityDirectory.name,
      })
      .from(domainEvent)
      .leftJoin(
        bidIdentityDirectory,
        eq(bidIdentityDirectory.subjectId, sql`${domainEvent.payload}->>'member_user_id'`),
      )
      .where(
        and(
          eq(domainEvent.aggregateType, "legal_entity"),
          eq(domainEvent.aggregateId, legalEntityId),
          eq(domainEvent.eventType, EVENT_TYPE),
          gte(domainEvent.occurredAt, since),
        ),
      )
      .orderBy(desc(domainEvent.occurredAt))
      .limit(200);

    const groups: StoppedMemberBids[] = [];
    for (const row of rows) {
      const payload = (row.payload ?? {}) as Payload;
      const stopped = toBid(payload);
      const memberUserId =
        typeof payload.member_user_id === "string" ? payload.member_user_id : null;
      if (!stopped || !memberUserId) continue;
      const group = groups.find(
        (g) =>
          g.memberUserId === memberUserId &&
          Math.abs(g.stoppedAt.getTime() - row.occurredAt.getTime()) <= SAME_REMOVAL_MS,
      );
      if (group) group.bids.push(stopped);
      else {
        groups.push({
          memberUserId,
          memberName: row.memberName ?? "A former member",
          stoppedAt: row.occurredAt,
          bids: [stopped],
        });
      }
    }
    return groups;
  }
}
