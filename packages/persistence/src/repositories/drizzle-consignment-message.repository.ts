import type { Database } from "@auction/db";
import {
  bidIdentityDirectory,
  consignmentMessage,
  consignmentMessageAttachment,
  consignmentThread,
  itemSubmission,
  legalEntity,
  lot,
  uploadObject,
} from "@auction/db/schema";
import { type ConsignmentMessageSide, otherSide } from "@auction/domain";
import type { LegalEntityStatus } from "@auction/types";
import { type SQL, and, asc, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  AttachableUpload,
  ConsignmentMessageRow,
  ConsignmentThreadInboxQuery,
  ConsignmentThreadSubject,
  ConsignmentThreadSummaryRow,
  IConsignmentMessageRepository,
  NewConsignmentMessage,
} from "../interfaces/consignment-message.repository.js";

const authorDirectory = alias(bidIdentityDirectory, "author_directory");
const specialistDirectory = alias(bidIdentityDirectory, "specialist_directory");

function specialistOf(userId: string | null, name: string | null) {
  return userId ? { userId, name: name ?? "Your specialist" } : null;
}

export class DrizzleConsignmentMessageRepository implements IConsignmentMessageRepository {
  constructor(private readonly db: Database) {}

  async findSubject(submissionId: string): Promise<ConsignmentThreadSubject | null> {
    const [row] = await this.db
      .select({
        submissionId: itemSubmission.id,
        title: itemSubmission.title,
        referenceNumber: itemSubmission.referenceNumber,
        submittedByUserId: itemSubmission.submittedByUserId,
        accountId: legalEntity.id,
        accountName: legalEntity.displayName,
        accountKind: legalEntity.kind,
        accountStatus: legalEntity.status,
        specialistId: itemSubmission.assignedToUserId,
        specialistName: specialistDirectory.name,
        saleId: lot.saleId,
      })
      .from(itemSubmission)
      .leftJoin(legalEntity, eq(legalEntity.id, itemSubmission.legalEntityId))
      .leftJoin(
        specialistDirectory,
        eq(specialistDirectory.subjectId, itemSubmission.assignedToUserId),
      )
      .leftJoin(lot, eq(lot.id, itemSubmission.convertedLotId))
      .where(eq(itemSubmission.id, submissionId))
      .limit(1);
    if (!row) return null;
    return {
      submissionId: row.submissionId,
      title: row.title,
      referenceNumber: row.referenceNumber,
      submittedByUserId: row.submittedByUserId,
      account:
        row.accountId && row.accountName && row.accountKind && row.accountStatus
          ? {
              id: row.accountId,
              name: row.accountName,
              kind: row.accountKind,
              status: row.accountStatus as LegalEntityStatus,
            }
          : null,
      specialist: specialistOf(row.specialistId, row.specialistName),
      saleId: row.saleId ?? null,
    };
  }

  async listMessages(submissionId: string): Promise<ConsignmentMessageRow[]> {
    const messages = await this.db
      .select({
        id: consignmentMessage.id,
        authorUserId: consignmentMessage.authorUserId,
        authorName: authorDirectory.name,
        authorSide: consignmentMessage.authorSide,
        body: consignmentMessage.body,
        createdAt: consignmentMessage.createdAt,
        readAt: consignmentMessage.readAt,
      })
      .from(consignmentMessage)
      .innerJoin(consignmentThread, eq(consignmentThread.id, consignmentMessage.threadId))
      .leftJoin(authorDirectory, eq(authorDirectory.subjectId, consignmentMessage.authorUserId))
      .where(eq(consignmentThread.submissionId, submissionId))
      .orderBy(asc(consignmentMessage.createdAt), asc(consignmentMessage.id));
    if (messages.length === 0) return [];
    const attachments = await this.db
      .select({
        id: consignmentMessageAttachment.id,
        messageId: consignmentMessageAttachment.messageId,
        uploadObjectId: consignmentMessageAttachment.uploadObjectId,
        fileName: consignmentMessageAttachment.fileName,
        key: uploadObject.key,
        contentType: uploadObject.actualContentType,
        byteSize: uploadObject.actualByteSize,
      })
      .from(consignmentMessageAttachment)
      .innerJoin(uploadObject, eq(uploadObject.id, consignmentMessageAttachment.uploadObjectId))
      .where(
        inArray(
          consignmentMessageAttachment.messageId,
          messages.map((m) => m.id),
        ),
      )
      .orderBy(asc(consignmentMessageAttachment.createdAt), asc(consignmentMessageAttachment.id));
    const byMessage = new Map<string, ConsignmentMessageRow["attachments"]>();
    for (const { messageId, ...attachment } of attachments) {
      const list = byMessage.get(messageId) ?? [];
      list.push(attachment);
      byMessage.set(messageId, list);
    }
    return messages.map((m) => ({
      ...m,
      authorName: m.authorName ?? null,
      authorSide: m.authorSide as ConsignmentMessageSide,
      attachments: byMessage.get(m.id) ?? [],
    }));
  }

  async findUploads(uploadObjectIds: readonly string[]): Promise<AttachableUpload[]> {
    if (uploadObjectIds.length === 0) return [];
    return this.db
      .select({
        id: uploadObject.id,
        ownerUserId: uploadObject.ownerUserId,
        kind: uploadObject.kind,
        status: uploadObject.status,
      })
      .from(uploadObject)
      .where(inArray(uploadObject.id, [...uploadObjectIds]));
  }

  async append(input: NewConsignmentMessage): Promise<{ messageId: string }> {
    return this.db.transaction(async (tx) => {
      const [thread] = await tx
        .insert(consignmentThread)
        .values({
          submissionId: input.submissionId,
          lastMessageAt: input.at,
          lastMessageSide: input.side,
        })
        .onConflictDoUpdate({
          target: consignmentThread.submissionId,
          set: { lastMessageAt: input.at, lastMessageSide: input.side },
        })
        .returning({ id: consignmentThread.id });
      if (!thread) throw new Error("consignment thread was not written");
      const [message] = await tx
        .insert(consignmentMessage)
        .values({
          threadId: thread.id,
          authorUserId: input.authorUserId,
          authorSide: input.side,
          body: input.body,
          createdAt: input.at,
        })
        .returning({ id: consignmentMessage.id });
      if (!message) throw new Error("consignment message was not written");
      if (input.attachments.length > 0) {
        await tx.insert(consignmentMessageAttachment).values(
          input.attachments.map((attachment) => ({
            messageId: message.id,
            uploadObjectId: attachment.uploadObjectId,
            fileName: attachment.fileName,
          })),
        );
      }
      return { messageId: message.id };
    });
  }

  async markRead(input: {
    submissionId: string;
    readerSide: ConsignmentMessageSide;
    at: Date;
  }): Promise<number> {
    const threadIds = this.db
      .select({ id: consignmentThread.id })
      .from(consignmentThread)
      .where(eq(consignmentThread.submissionId, input.submissionId));
    const changed = await this.db
      .update(consignmentMessage)
      .set({ readAt: input.at })
      .where(
        and(
          inArray(consignmentMessage.threadId, threadIds),
          eq(consignmentMessage.authorSide, otherSide(input.readerSide)),
          isNull(consignmentMessage.readAt),
        ),
      )
      .returning({ id: consignmentMessage.id });
    return changed.length;
  }

  async listThreadsForStaff(
    query: ConsignmentThreadInboxQuery,
  ): Promise<ConsignmentThreadSummaryRow[]> {
    const lastBody = sql<string>`(
      select ${consignmentMessage.body} from ${consignmentMessage}
      where ${consignmentMessage.threadId} = ${consignmentThread.id}
      order by ${consignmentMessage.createdAt} desc, ${consignmentMessage.id} desc
      limit 1
    )`;
    const unread = sql<number>`(
      select count(*)::int from ${consignmentMessage}
      where ${consignmentMessage.threadId} = ${consignmentThread.id}
        and ${consignmentMessage.authorSide} = 'client'
        and ${consignmentMessage.readAt} is null
    )`;
    const filters: (SQL | undefined)[] = [
      query.awaitingStaff ? eq(consignmentThread.lastMessageSide, "client") : undefined,
      query.assigned?.kind === "user"
        ? eq(itemSubmission.assignedToUserId, query.assigned.userId)
        : query.assigned?.kind === "unassigned"
          ? isNull(itemSubmission.assignedToUserId)
          : undefined,
      query.saleId ? eq(lot.saleId, query.saleId) : undefined,
      query.before
        ? or(
            lt(consignmentThread.lastMessageAt, query.before.lastMessageAt),
            and(
              eq(consignmentThread.lastMessageAt, query.before.lastMessageAt),
              lt(consignmentThread.submissionId, query.before.submissionId),
            ),
          )
        : undefined,
    ];
    const rows = await this.db
      .select({
        submissionId: itemSubmission.id,
        title: itemSubmission.title,
        referenceNumber: itemSubmission.referenceNumber,
        accountId: legalEntity.id,
        accountName: legalEntity.displayName,
        specialistId: itemSubmission.assignedToUserId,
        specialistName: specialistDirectory.name,
        saleId: lot.saleId,
        lastMessageAt: consignmentThread.lastMessageAt,
        lastMessageSide: consignmentThread.lastMessageSide,
        lastMessageBody: lastBody,
        unreadForStaff: unread,
      })
      .from(consignmentThread)
      .innerJoin(itemSubmission, eq(itemSubmission.id, consignmentThread.submissionId))
      .leftJoin(legalEntity, eq(legalEntity.id, itemSubmission.legalEntityId))
      .leftJoin(
        specialistDirectory,
        eq(specialistDirectory.subjectId, itemSubmission.assignedToUserId),
      )
      .leftJoin(lot, eq(lot.id, itemSubmission.convertedLotId))
      .where(and(...filters))
      .orderBy(desc(consignmentThread.lastMessageAt), desc(consignmentThread.submissionId))
      .limit(query.limit);
    return rows.map((row) => ({
      submissionId: row.submissionId,
      title: row.title,
      referenceNumber: row.referenceNumber,
      account:
        row.accountId && row.accountName ? { id: row.accountId, name: row.accountName } : null,
      specialist: specialistOf(row.specialistId, row.specialistName),
      saleId: row.saleId ?? null,
      lastMessageAt: row.lastMessageAt,
      lastMessageSide: row.lastMessageSide as ConsignmentMessageSide,
      lastMessageBody: row.lastMessageBody ?? "",
      unreadForStaff: Number(row.unreadForStaff ?? 0),
    }));
  }
}
