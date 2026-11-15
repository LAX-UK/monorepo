import type { Database } from "@auction/db";
import {
  enquiryInboundQuarantine,
  marketingEnquiry,
  marketingEnquiryMessage,
} from "@auction/db/schema";
import {
  type EnquiryIntent,
  type InboundMatchMethod,
  type InboundQuarantineReason,
  type InboundQuarantineStatus,
  PRIVATE_SALE_ENQUIRY_INTENTS,
} from "@auction/domain";
import {
  type SQL,
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import type {
  IEnquiryInboundThreadReader,
  IEnquiryQuarantineReviewRepository,
  InboundThreadMessage,
  QuarantineListFilter,
  QuarantineScope,
  QuarantinedMessageRecord,
  QuarantinedMessageSummary,
} from "../interfaces/enquiry-inbound-review.repository.js";

const q = enquiryInboundQuarantine;
const suspect = marketingEnquiry;
const PRIVATE_INTENTS = [...PRIVATE_SALE_ENQUIRY_INTENTS];

/** Mail suspected to belong to a private sale enquiry needs private sale access; the rest general. */
function scopeCondition(scope: QuarantineScope): SQL {
  const allowed: SQL[] = [];
  if (scope.readsPrivateSale) allowed.push(inArray(suspect.intent, PRIVATE_INTENTS));
  if (scope.readsGeneral) {
    allowed.push(or(isNull(suspect.id), notInArray(suspect.intent, PRIVATE_INTENTS)) as SQL);
  }
  return allowed.length ? (or(...allowed) as SQL) : sql`false`;
}

const SUMMARY_COLUMNS = {
  id: q.id,
  reason: q.reason,
  status: q.status,
  fromAddress: q.fromAddress,
  subject: q.subject,
  attachments: q.attachments,
  receivedAt: q.receivedAt,
  purgeAt: q.purgeAt,
  reviewedAt: q.reviewedAt,
  suspectId: suspect.id,
  suspectReference: suspect.reference,
  suspectIntent: suspect.intent,
};

const RECORD_COLUMNS = {
  ...SUMMARY_COLUMNS,
  providerMessageId: q.providerMessageId,
  body: q.body,
  spfResult: q.spfResult,
  dkimResult: q.dkimResult,
  reviewedByUserId: q.reviewedByUserId,
};

type SummaryRow = {
  id: string;
  reason: string;
  status: string;
  fromAddress: string;
  subject: string;
  attachments: QuarantinedMessageRecord["attachments"];
  receivedAt: Date;
  purgeAt: Date;
  reviewedAt: Date | null;
  suspectId: string | null;
  suspectReference: string | null;
  suspectIntent: string | null;
};

type RecordRow = SummaryRow & {
  providerMessageId: string;
  body: string;
  spfResult: QuarantinedMessageRecord["spfResult"];
  dkimResult: QuarantinedMessageRecord["dkimResult"];
  reviewedByUserId: string | null;
};

function toSummary(row: SummaryRow): QuarantinedMessageSummary {
  return {
    id: row.id,
    reason: row.reason as InboundQuarantineReason,
    status: row.status as InboundQuarantineStatus,
    fromAddress: row.fromAddress,
    subject: row.subject,
    attachmentCount: row.attachments.length,
    suspectedEnquiry:
      row.suspectId && row.suspectReference && row.suspectIntent
        ? {
            id: row.suspectId,
            reference: row.suspectReference,
            intent: row.suspectIntent as EnquiryIntent,
          }
        : null,
    receivedAt: row.receivedAt,
    purgeAt: row.purgeAt,
    reviewedAt: row.reviewedAt,
  };
}

function toRecord(row: RecordRow): QuarantinedMessageRecord {
  return {
    ...toSummary(row),
    providerMessageId: row.providerMessageId,
    body: row.body,
    attachments: row.attachments,
    spfResult: row.spfResult,
    dkimResult: row.dkimResult,
    reviewedByUserId: row.reviewedByUserId,
  };
}

export class DrizzleEnquiryQuarantineReviewRepository
  implements IEnquiryQuarantineReviewRepository
{
  constructor(private readonly db: Database) {}

  async list(filter: QuarantineListFilter): Promise<QuarantinedMessageSummary[]> {
    const conditions: SQL[] = [
      scopeCondition(filter.scope),
      filter.view === "pending" ? eq(q.status, "pending") : ne(q.status, "pending"),
    ];
    if (filter.after) {
      const { receivedAt, id } = filter.after;
      conditions.push(
        or(lt(q.receivedAt, receivedAt), and(eq(q.receivedAt, receivedAt), lt(q.id, id))) as SQL,
      );
    }
    const rows = await this.db
      .select(SUMMARY_COLUMNS)
      .from(q)
      .leftJoin(suspect, eq(suspect.id, q.suspectedEnquiryId))
      .where(and(...conditions))
      .orderBy(desc(q.receivedAt), desc(q.id))
      .limit(filter.limit + 1);
    return rows.map(toSummary);
  }

  async countPending(scope: QuarantineScope): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(q)
      .leftJoin(suspect, eq(suspect.id, q.suspectedEnquiryId))
      .where(and(scopeCondition(scope), eq(q.status, "pending")));
    return row?.count ?? 0;
  }

  async findById(id: string, scope: QuarantineScope): Promise<QuarantinedMessageRecord | null> {
    const [row] = await this.db
      .select(RECORD_COLUMNS)
      .from(q)
      .leftJoin(suspect, eq(suspect.id, q.suspectedEnquiryId))
      .where(and(eq(q.id, id), scopeCondition(scope)))
      .limit(1);
    return row ? toRecord(row) : null;
  }

  async lockInTransaction(tx: Database, id: string): Promise<QuarantinedMessageRecord | null> {
    const [row] = await tx
      .select(RECORD_COLUMNS)
      .from(q)
      .leftJoin(suspect, eq(suspect.id, q.suspectedEnquiryId))
      .where(eq(q.id, id))
      .limit(1)
      .for("update", { of: q });
    return row ? toRecord(row) : null;
  }

  async markReviewedInTransaction(
    tx: Database,
    id: string,
    review: { status: "linked" | "dismissed"; byUserId: string; at: Date },
  ): Promise<void> {
    await tx
      .update(q)
      .set({ status: review.status, reviewedByUserId: review.byUserId, reviewedAt: review.at })
      .where(and(eq(q.id, id), eq(q.status, "pending")));
  }
}

export class DrizzleEnquiryInboundThreadReader implements IEnquiryInboundThreadReader {
  constructor(private readonly db: Database) {}

  async listInbound(enquiryId: string, limit: number): Promise<InboundThreadMessage[]> {
    const m = marketingEnquiryMessage;
    const rows = await this.db
      .select({
        id: m.id,
        receivedAt: m.createdAt,
        subject: m.subject,
        body: m.body,
        attachments: m.attachments,
        matchedBy: m.matchedBy,
        spfResult: m.spfResult,
        dkimResult: m.dkimResult,
      })
      .from(m)
      .where(and(eq(m.enquiryId, enquiryId), eq(m.direction, "inbound")))
      .orderBy(asc(m.createdAt), asc(m.id))
      .limit(limit);
    return rows.map((row) => ({
      ...row,
      matchedBy: (row.matchedBy ?? "token") as InboundMatchMethod,
    }));
  }
}
