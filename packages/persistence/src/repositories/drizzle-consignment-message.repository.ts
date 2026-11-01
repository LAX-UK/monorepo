import type { Database } from "@auction/db";
import {
  bidIdentityDirectory,
  consignmentMessage,
  consignmentMessageAttachment,
  consignmentThread,
  consignmentThreadEvent,
  itemSubmission,
  legalEntity,
  legalEntityMember,
  lot,
  uploadObject,
} from "@auction/db/schema";
import {
  type ConsignmentMessageSide,
  type ConsignmentMessageVisibility,
  markersAfterMessage,
  markersFromMessages,
  otherSide,
} from "@auction/domain";
import type { LegalEntityStatus } from "@auction/types";
import {
  type SQL,
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  AssignThreadInput,
  AssignThreadResult,
  AttachableUpload,
  ClaimedReplyNotice,
  ConsignmentMessageAudience,
  ConsignmentMessageRow,
  ConsignmentThreadEventKind,
  ConsignmentThreadEventRecord,
  ConsignmentThreadSubject,
  EndedCover,
  IConsignmentMessageRepository,
  NewConsignmentMessage,
  StaffPersonRecord,
  UndoHeldReplyResult,
} from "../interfaces/consignment-message.repository.js";
import { staffRolesInForceFor } from "../lib/staff-role-assignment-sql.js";

const authorDirectory = alias(bidIdentityDirectory, "author_directory");
const specialistDirectory = alias(bidIdentityDirectory, "specialist_directory");
const coveringDirectory = alias(bidIdentityDirectory, "covering_directory");
const closedByDirectory = alias(bidIdentityDirectory, "closed_by_directory");
const actorDirectory = alias(bidIdentityDirectory, "actor_directory");
const subjectDirectory = alias(bidIdentityDirectory, "subject_directory");

function personOf(userId: string | null, name: string | null, fallback: string) {
  return userId ? { userId, name: name ?? fallback } : null;
}

/** Who the account may read: staff replies still held back, and notes, stay with staff. */
function audienceFilter(audience: ConsignmentMessageAudience): SQL | undefined {
  if (audience.kind === "staff") return undefined;
  return and(
    eq(consignmentMessage.visibility, "thread"),
    or(isNull(consignmentMessage.deliverAfter), lte(consignmentMessage.deliverAfter, audience.now)),
  );
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
        coveringId: consignmentThread.coveringUserId,
        coveringName: coveringDirectory.name,
        coveringUntil: consignmentThread.coveringUntil,
        saleId: lot.saleId,
        threadId: consignmentThread.id,
        lastMessageAt: consignmentThread.lastMessageAt,
        lastMessageSide: consignmentThread.lastMessageSide,
        awaitingSince: consignmentThread.awaitingSince,
        closedAt: consignmentThread.closedAt,
        closedById: consignmentThread.closedByUserId,
        closedByName: closedByDirectory.name,
      })
      .from(itemSubmission)
      .leftJoin(legalEntity, eq(legalEntity.id, itemSubmission.legalEntityId))
      .leftJoin(
        specialistDirectory,
        eq(specialistDirectory.subjectId, itemSubmission.assignedToUserId),
      )
      .leftJoin(consignmentThread, eq(consignmentThread.submissionId, itemSubmission.id))
      .leftJoin(
        coveringDirectory,
        eq(coveringDirectory.subjectId, consignmentThread.coveringUserId),
      )
      .leftJoin(
        closedByDirectory,
        eq(closedByDirectory.subjectId, consignmentThread.closedByUserId),
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
      specialist: personOf(row.specialistId, row.specialistName, "Your specialist"),
      covering: personOf(row.coveringId, row.coveringName, "A colleague"),
      coveringUntil: row.coveringId ? row.coveringUntil : null,
      saleId: row.saleId ?? null,
      thread:
        row.threadId && row.lastMessageAt && row.lastMessageSide
          ? {
              id: row.threadId,
              lastMessageAt: row.lastMessageAt,
              lastMessageSide: row.lastMessageSide as ConsignmentMessageSide,
              awaitingSince: row.awaitingSince,
              closedAt: row.closedAt,
              closedBy: personOf(row.closedById, row.closedByName, "A colleague"),
            }
          : null,
    };
  }

  async listMessages(
    submissionId: string,
    audience: ConsignmentMessageAudience,
  ): Promise<ConsignmentMessageRow[]> {
    const messages = await this.db
      .select({
        id: consignmentMessage.id,
        authorUserId: consignmentMessage.authorUserId,
        authorName: authorDirectory.name,
        authorMemberRole: legalEntityMember.role,
        authorStaffRoles: staffRolesInForceFor(consignmentMessage.authorUserId),
        authorSide: consignmentMessage.authorSide,
        visibility: consignmentMessage.visibility,
        body: consignmentMessage.body,
        createdAt: consignmentMessage.createdAt,
        deliverAfter: consignmentMessage.deliverAfter,
        readAt: consignmentMessage.readAt,
      })
      .from(consignmentMessage)
      .innerJoin(consignmentThread, eq(consignmentThread.id, consignmentMessage.threadId))
      .innerJoin(itemSubmission, eq(itemSubmission.id, consignmentThread.submissionId))
      .leftJoin(authorDirectory, eq(authorDirectory.subjectId, consignmentMessage.authorUserId))
      .leftJoin(
        legalEntityMember,
        and(
          eq(legalEntityMember.legalEntityId, itemSubmission.legalEntityId),
          eq(legalEntityMember.userId, consignmentMessage.authorUserId),
          isNull(legalEntityMember.removedAt),
        ),
      )
      .where(and(eq(consignmentThread.submissionId, submissionId), audienceFilter(audience)))
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
      authorMemberRole: m.authorMemberRole ?? null,
      authorStaffRoles: m.authorStaffRoles ?? [],
      authorSide: m.authorSide as ConsignmentMessageSide,
      visibility: m.visibility as ConsignmentMessageVisibility,
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

  async append(input: NewConsignmentMessage): Promise<{ messageId: string; reopened: boolean }> {
    return this.db.transaction(async (tx) => {
      const opening = markersAfterMessage(null, {
        side: input.side,
        visibility: input.visibility,
        at: input.at,
      }).markers;
      // The first message opens the thread; a second opening at the same moment finds it there.
      await tx
        .insert(consignmentThread)
        .values({
          submissionId: input.submissionId,
          lastMessageAt: opening.lastMessageAt,
          lastMessageSide: opening.lastMessageSide,
          awaitingSince: opening.awaitingSince,
        })
        .onConflictDoNothing({ target: consignmentThread.submissionId });
      const [thread] = await tx
        .select()
        .from(consignmentThread)
        .where(eq(consignmentThread.submissionId, input.submissionId))
        .limit(1)
        .for("update");
      if (!thread) throw new Error("consignment thread was not written");
      const { markers, reopened } = markersAfterMessage(
        {
          lastMessageAt: thread.lastMessageAt,
          lastMessageSide: thread.lastMessageSide as ConsignmentMessageSide,
          awaitingSince: thread.awaitingSince,
          closedAt: thread.closedAt,
        },
        { side: input.side, visibility: input.visibility, at: input.at },
      );
      if (input.visibility === "thread") {
        await tx
          .update(consignmentThread)
          .set({
            lastMessageAt: markers.lastMessageAt,
            lastMessageSide: markers.lastMessageSide,
            awaitingSince: markers.awaitingSince,
            closedAt: markers.closedAt,
            ...(reopened ? { closedByUserId: null } : {}),
          })
          .where(eq(consignmentThread.id, thread.id));
      }
      if (reopened) {
        await tx.insert(consignmentThreadEvent).values({
          threadId: thread.id,
          kind: "reopened",
          actorUserId: input.side === "client" ? null : input.authorUserId,
          createdAt: input.at,
        });
      }
      const [message] = await tx
        .insert(consignmentMessage)
        .values({
          threadId: thread.id,
          authorUserId: input.authorUserId,
          authorSide: input.side,
          visibility: input.visibility,
          body: input.body,
          deliverAfter: input.deliverAfter,
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
      return { messageId: message.id, reopened };
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
    const releasedToClient =
      input.readerSide === "client"
        ? or(
            isNull(consignmentMessage.deliverAfter),
            lte(consignmentMessage.deliverAfter, input.at),
          )
        : undefined;
    const changed = await this.db
      .update(consignmentMessage)
      .set({ readAt: input.at })
      .where(
        and(
          inArray(consignmentMessage.threadId, threadIds),
          eq(consignmentMessage.authorSide, otherSide(input.readerSide)),
          eq(consignmentMessage.visibility, "thread"),
          isNull(consignmentMessage.readAt),
          releasedToClient,
        ),
      )
      .returning({ id: consignmentMessage.id });
    return changed.length;
  }

  async markNewestClientMessageUnread(submissionId: string): Promise<boolean> {
    const [newest] = await this.db
      .select({ id: consignmentMessage.id })
      .from(consignmentMessage)
      .innerJoin(consignmentThread, eq(consignmentThread.id, consignmentMessage.threadId))
      .where(
        and(
          eq(consignmentThread.submissionId, submissionId),
          eq(consignmentMessage.authorSide, "client"),
        ),
      )
      .orderBy(desc(consignmentMessage.createdAt), desc(consignmentMessage.id))
      .limit(1);
    if (!newest) return false;
    await this.db
      .update(consignmentMessage)
      .set({ readAt: null })
      .where(eq(consignmentMessage.id, newest.id));
    return true;
  }

  async deleteHeldReply(input: {
    messageId: string;
    authorUserId: string;
    now: Date;
  }): Promise<UndoHeldReplyResult> {
    return this.db.transaction(async (tx) => {
      const [message] = await tx
        .select({
          threadId: consignmentMessage.threadId,
          authorUserId: consignmentMessage.authorUserId,
          authorSide: consignmentMessage.authorSide,
          visibility: consignmentMessage.visibility,
          deliverAfter: consignmentMessage.deliverAfter,
        })
        .from(consignmentMessage)
        .where(eq(consignmentMessage.id, input.messageId))
        .limit(1)
        .for("update");
      if (
        !message ||
        message.authorUserId !== input.authorUserId ||
        message.authorSide !== "staff" ||
        message.visibility !== "thread"
      ) {
        return { outcome: "not_found" };
      }
      if (!message.deliverAfter || message.deliverAfter.getTime() <= input.now.getTime()) {
        return { outcome: "expired" };
      }
      const [thread] = await tx
        .select()
        .from(consignmentThread)
        .where(eq(consignmentThread.id, message.threadId))
        .limit(1)
        .for("update");
      if (!thread) return { outcome: "not_found" };
      await tx.delete(consignmentMessage).where(eq(consignmentMessage.id, input.messageId));
      const left = await tx
        .select({
          side: consignmentMessage.authorSide,
          visibility: consignmentMessage.visibility,
          at: consignmentMessage.createdAt,
        })
        .from(consignmentMessage)
        .where(eq(consignmentMessage.threadId, thread.id))
        .orderBy(asc(consignmentMessage.createdAt), asc(consignmentMessage.id));
      const markers = markersFromMessages(
        left.map((m) => ({
          side: m.side as ConsignmentMessageSide,
          visibility: m.visibility as ConsignmentMessageVisibility,
          at: m.at,
        })),
        thread.closedAt,
      );
      if (markers) {
        await tx
          .update(consignmentThread)
          .set({
            lastMessageAt: markers.lastMessageAt,
            lastMessageSide: markers.lastMessageSide,
            awaitingSince: markers.awaitingSince,
          })
          .where(eq(consignmentThread.id, thread.id));
      }
      return { outcome: "deleted", submissionId: thread.submissionId };
    });
  }

  async releaseHeldReply(messageId: string, now: Date): Promise<boolean> {
    const released = await this.db
      .update(consignmentMessage)
      .set({ deliverAfter: now })
      .where(eq(consignmentMessage.id, messageId))
      .returning({ id: consignmentMessage.id });
    return released.length > 0;
  }

  async claimReplyNotice(messageId: string, now: Date): Promise<ClaimedReplyNotice | null> {
    const [claimed] = await this.db
      .update(consignmentMessage)
      .set({ notifiedAt: now })
      .where(
        and(
          eq(consignmentMessage.id, messageId),
          isNull(consignmentMessage.notifiedAt),
          eq(consignmentMessage.authorSide, "staff"),
          eq(consignmentMessage.visibility, "thread"),
          or(isNull(consignmentMessage.deliverAfter), lte(consignmentMessage.deliverAfter, now)),
        ),
      )
      .returning({
        threadId: consignmentMessage.threadId,
        authorUserId: consignmentMessage.authorUserId,
        body: consignmentMessage.body,
      });
    if (!claimed) return null;
    const [thread] = await this.db
      .select({ submissionId: consignmentThread.submissionId })
      .from(consignmentThread)
      .where(eq(consignmentThread.id, claimed.threadId))
      .limit(1);
    const [author] = claimed.authorUserId
      ? await this.db
          .select({ name: bidIdentityDirectory.name })
          .from(bidIdentityDirectory)
          .where(eq(bidIdentityDirectory.subjectId, claimed.authorUserId))
          .limit(1)
      : [];
    const [files] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(consignmentMessageAttachment)
      .where(eq(consignmentMessageAttachment.messageId, messageId));
    if (!thread) return null;
    return {
      submissionId: thread.submissionId,
      authorName: author?.name ?? "LAX specialist",
      body: claimed.body,
      fileCount: Number(files?.count ?? 0),
    };
  }

  closeThread(input: { submissionId: string; actorUserId: string; at: Date }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [closed] = await tx
        .update(consignmentThread)
        .set({ closedAt: input.at, closedByUserId: input.actorUserId })
        .where(
          and(
            eq(consignmentThread.submissionId, input.submissionId),
            isNull(consignmentThread.closedAt),
          ),
        )
        .returning({ id: consignmentThread.id });
      if (!closed) return false;
      await tx.insert(consignmentThreadEvent).values({
        threadId: closed.id,
        kind: "closed",
        actorUserId: input.actorUserId,
        createdAt: input.at,
      });
      return true;
    });
  }

  reopenThread(input: { submissionId: string; actorUserId: string; at: Date }): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      const [reopened] = await tx
        .update(consignmentThread)
        .set({ closedAt: null, closedByUserId: null })
        .where(
          and(
            eq(consignmentThread.submissionId, input.submissionId),
            sql`${consignmentThread.closedAt} IS NOT NULL`,
          ),
        )
        .returning({ id: consignmentThread.id });
      if (!reopened) return false;
      await tx.insert(consignmentThreadEvent).values({
        threadId: reopened.id,
        kind: "reopened",
        actorUserId: input.actorUserId,
        createdAt: input.at,
      });
      return true;
    });
  }

  assignThread(input: AssignThreadInput): Promise<AssignThreadResult> {
    return this.db.transaction(async (tx) => {
      const [submission] = await tx
        .select({ assignedTo: itemSubmission.assignedToUserId })
        .from(itemSubmission)
        .where(eq(itemSubmission.id, input.submissionId))
        .limit(1)
        .for("update");
      if (!submission) return { outcome: "no_thread" };
      const [thread] = await tx
        .select({
          id: consignmentThread.id,
          covering: consignmentThread.coveringUserId,
          until: consignmentThread.coveringUntil,
        })
        .from(consignmentThread)
        .where(eq(consignmentThread.submissionId, input.submissionId))
        .limit(1)
        .for("update");
      const target = input.assignedToUserId;
      // Covering for the specialist themself is the end of cover.
      const coversOnly = input.covering && target !== null && target !== submission.assignedTo;
      const recordEvent = async (kind: ConsignmentThreadEventKind) => {
        if (!thread) return;
        await tx.insert(consignmentThreadEvent).values({
          threadId: thread.id,
          kind,
          actorUserId: input.actorUserId,
          subjectUserId: target,
          createdAt: input.at,
        });
      };

      if (coversOnly) {
        if (!thread) return { outcome: "no_thread" };
        if (
          thread.covering === target &&
          thread.until?.getTime() === input.coveringUntil?.getTime()
        ) {
          return { outcome: "unchanged" };
        }
        await tx
          .update(consignmentThread)
          .set({ coveringUserId: target, coveringUntil: input.coveringUntil })
          .where(eq(consignmentThread.id, thread.id));
        await recordEvent("covering");
        return { outcome: "changed", event: "covering" };
      }

      if (submission.assignedTo === target && !thread?.covering) return { outcome: "unchanged" };
      await tx
        .update(itemSubmission)
        .set({ assignedToUserId: target, updatedAt: input.at })
        .where(eq(itemSubmission.id, input.submissionId));
      if (thread?.covering) {
        await tx
          .update(consignmentThread)
          .set({ coveringUserId: null, coveringUntil: null })
          .where(eq(consignmentThread.id, thread.id));
      }
      const kind: ConsignmentThreadEventKind = target ? "assigned" : "unassigned";
      await recordEvent(kind);
      return { outcome: "changed", event: thread ? kind : null };
    });
  }

  endElapsedCovers(now: Date): Promise<EndedCover[]> {
    return this.db.transaction(async (tx) => {
      const due = await tx
        .select({
          threadId: consignmentThread.id,
          submissionId: consignmentThread.submissionId,
          specialistId: itemSubmission.assignedToUserId,
          specialistName: specialistDirectory.name,
        })
        .from(consignmentThread)
        .innerJoin(itemSubmission, eq(itemSubmission.id, consignmentThread.submissionId))
        .leftJoin(
          specialistDirectory,
          eq(specialistDirectory.subjectId, itemSubmission.assignedToUserId),
        )
        .where(
          and(
            isNotNull(consignmentThread.coveringUserId),
            isNotNull(consignmentThread.coveringUntil),
            lte(consignmentThread.coveringUntil, now),
          ),
        )
        .for("update", { of: consignmentThread, skipLocked: true });
      if (due.length === 0) return [];
      await tx
        .update(consignmentThread)
        .set({ coveringUserId: null, coveringUntil: null })
        .where(
          inArray(
            consignmentThread.id,
            due.map((row) => row.threadId),
          ),
        );
      await tx.insert(consignmentThreadEvent).values(
        due.map((row) => ({
          threadId: row.threadId,
          kind: row.specialistId ? ("assigned" as const) : ("unassigned" as const),
          actorUserId: null,
          subjectUserId: row.specialistId,
          createdAt: now,
        })),
      );
      return due.map((row) => ({
        submissionId: row.submissionId,
        specialist: personOf(row.specialistId, row.specialistName, "Your specialist"),
      }));
    });
  }

  async listOverdueReplyNotices(cutoff: Date, limit: number): Promise<string[]> {
    const rows = await this.db
      .select({ id: consignmentMessage.id })
      .from(consignmentMessage)
      .where(
        and(
          isNull(consignmentMessage.notifiedAt),
          eq(consignmentMessage.authorSide, "staff"),
          eq(consignmentMessage.visibility, "thread"),
          isNotNull(consignmentMessage.deliverAfter),
          lte(consignmentMessage.deliverAfter, cutoff),
        ),
      )
      .orderBy(asc(consignmentMessage.deliverAfter))
      .limit(limit);
    return rows.map((row) => row.id);
  }

  async listEvents(submissionId: string): Promise<ConsignmentThreadEventRecord[]> {
    const rows = await this.db
      .select({
        id: consignmentThreadEvent.id,
        kind: consignmentThreadEvent.kind,
        actorId: consignmentThreadEvent.actorUserId,
        actorName: actorDirectory.name,
        subjectId: consignmentThreadEvent.subjectUserId,
        subjectName: subjectDirectory.name,
        at: consignmentThreadEvent.createdAt,
      })
      .from(consignmentThreadEvent)
      .innerJoin(consignmentThread, eq(consignmentThread.id, consignmentThreadEvent.threadId))
      .leftJoin(actorDirectory, eq(actorDirectory.subjectId, consignmentThreadEvent.actorUserId))
      .leftJoin(
        subjectDirectory,
        eq(subjectDirectory.subjectId, consignmentThreadEvent.subjectUserId),
      )
      .where(eq(consignmentThread.submissionId, submissionId))
      .orderBy(asc(consignmentThreadEvent.createdAt), asc(consignmentThreadEvent.id));
    const person = (userId: string | null, name: string | null): StaffPersonRecord | null =>
      personOf(userId, name, "A colleague");
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind as ConsignmentThreadEventKind,
      actor: person(row.actorId, row.actorName),
      subject: person(row.subjectId, row.subjectName),
      at: row.at,
    }));
  }
}
