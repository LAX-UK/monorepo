import {
  bidIdentityDirectory,
  conditionReportRequest,
  consignmentMessage,
  consignmentThread,
  itemSubmission,
  lot,
} from "@auction/db/schema";
import { and, asc, eq, isNotNull, or, sql } from "drizzle-orm";
import { type ExportSource, SourcedExportCategory } from "../sourced-export-category.js";
import type { SubjectExportDeps } from "../subject-export-deps.js";
import { firstName, isoRequired } from "../subject-export-values.js";
import { afterKey, countWhere } from "./keyset.js";

export function mapConsignmentMessage(row: {
  id: string;
  threadId: string;
  subject: string;
  authorSide: string;
  body: string;
  authorName: string | null;
  createdAt: Date;
}) {
  const fromPerson = row.authorSide === "client";
  return {
    id: row.id,
    origin: "provided" as const,
    threadId: row.threadId,
    subject: row.subject,
    direction: fromPerson ? "sent" : "received",
    body: row.body,
    // Staff are shown by first name only, as in the product.
    staffFirstName: fromPerson ? null : firstName(row.authorName),
    sentAt: isoRequired(row.createdAt),
  };
}

export function mapConditionReportMessage(row: {
  id: string;
  requestId: string;
  lotTitle: string;
  direction: "sent" | "received";
  body: string;
  staffName: string | null;
  at: Date;
}) {
  return {
    id: row.id,
    origin: "provided" as const,
    threadId: row.requestId,
    subject: `Condition report: ${row.lotTitle}`,
    direction: row.direction,
    body: row.body,
    staffFirstName: row.direction === "received" ? firstName(row.staffName) : null,
    sentAt: isoRequired(row.at),
  };
}

/** Staff-only notes in a thread (`internal` visibility) and replies still held back are not selected. */
const visibleToPerson = and(
  eq(consignmentMessage.visibility, "thread"),
  or(
    eq(consignmentMessage.authorSide, "client"),
    sql`${consignmentMessage.deliverAfter} IS NULL`,
    sql`${consignmentMessage.deliverAfter} <= now()`,
  ),
);

export class MessagesCategory extends SourcedExportCategory {
  readonly id = "messages";
  protected readonly sources: readonly ExportSource[];

  constructor({ db }: SubjectExportDeps) {
    super();
    const ownThread = (s: string) => and(eq(itemSubmission.submittedByUserId, s), visibleToPerson);

    this.sources = [
      {
        count: async (s) => {
          const [row] = await db
            .select({ n: sql<number>`count(*)` })
            .from(consignmentMessage)
            .innerJoin(consignmentThread, eq(consignmentThread.id, consignmentMessage.threadId))
            .innerJoin(itemSubmission, eq(itemSubmission.id, consignmentThread.submissionId))
            .where(ownThread(s));
          return Number(row?.n ?? 0);
        },
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: consignmentMessage.id,
              threadId: consignmentMessage.threadId,
              subject: itemSubmission.title,
              authorSide: consignmentMessage.authorSide,
              body: consignmentMessage.body,
              authorName: bidIdentityDirectory.name,
              createdAt: consignmentMessage.createdAt,
            })
            .from(consignmentMessage)
            .innerJoin(consignmentThread, eq(consignmentThread.id, consignmentMessage.threadId))
            .innerJoin(itemSubmission, eq(itemSubmission.id, consignmentThread.submissionId))
            .leftJoin(
              bidIdentityDirectory,
              eq(bidIdentityDirectory.subjectId, consignmentMessage.authorUserId),
            )
            .where(and(ownThread(s), afterKey(consignmentMessage.id, after)))
            .orderBy(asc(consignmentMessage.id))
            .limit(limit);
          return rows.map((row) => ({ key: row.id, record: mapConsignmentMessage(row) }));
        },
      },
      {
        count: (s) =>
          countWhere(db, conditionReportRequest, eq(conditionReportRequest.requestedByUserId, s)),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: conditionReportRequest.id,
              lotTitle: lot.title,
              note: conditionReportRequest.requestNote,
              createdAt: conditionReportRequest.createdAt,
            })
            .from(conditionReportRequest)
            .innerJoin(lot, eq(lot.id, conditionReportRequest.lotId))
            .where(
              and(
                eq(conditionReportRequest.requestedByUserId, s),
                afterKey(conditionReportRequest.id, after),
              ),
            )
            .orderBy(asc(conditionReportRequest.id))
            .limit(limit);
          return rows.map((row) => ({
            key: row.id,
            record: mapConditionReportMessage({
              id: row.id,
              requestId: row.id,
              lotTitle: row.lotTitle,
              direction: "sent",
              body: row.note ?? "",
              staffName: null,
              at: row.createdAt,
            }),
          }));
        },
      },
      {
        count: (s) =>
          countWhere(
            db,
            conditionReportRequest,
            and(
              eq(conditionReportRequest.requestedByUserId, s),
              isNotNull(conditionReportRequest.responseNote),
            ),
          ),
        page: async (s, after, limit) => {
          const rows = await db
            .select({
              id: conditionReportRequest.id,
              lotTitle: lot.title,
              note: conditionReportRequest.responseNote,
              fulfilledAt: conditionReportRequest.fulfilledAt,
              createdAt: conditionReportRequest.createdAt,
              staffName: bidIdentityDirectory.name,
            })
            .from(conditionReportRequest)
            .innerJoin(lot, eq(lot.id, conditionReportRequest.lotId))
            .leftJoin(
              bidIdentityDirectory,
              eq(bidIdentityDirectory.subjectId, conditionReportRequest.fulfilledByUserId),
            )
            .where(
              and(
                eq(conditionReportRequest.requestedByUserId, s),
                isNotNull(conditionReportRequest.responseNote),
                afterKey(conditionReportRequest.id, after),
              ),
            )
            .orderBy(asc(conditionReportRequest.id))
            .limit(limit);
          return rows.map((row) => ({
            key: row.id,
            record: mapConditionReportMessage({
              id: `${row.id}:response`,
              requestId: row.id,
              lotTitle: row.lotTitle,
              direction: "received",
              body: row.note ?? "",
              staffName: row.staffName,
              at: row.fulfilledAt ?? row.createdAt,
            }),
          }));
        },
      },
    ];
  }
}
