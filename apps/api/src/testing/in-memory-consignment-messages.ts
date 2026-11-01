import { randomUUID } from "node:crypto";
import {
  type ConsignmentMessageSide,
  type ConsignmentMessageVisibility,
  type ConsignmentThreadMarkers,
  markersAfterMessage,
  markersFromMessages,
  otherSide,
} from "@auction/domain";
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
} from "@auction/persistence/interfaces";

type StoredMessage = Omit<
  ConsignmentMessageRow,
  "authorName" | "authorMemberRole" | "authorStaffRoles"
> & {
  submissionId: string;
  notifiedAt: Date | null;
};

type StoredThread = ConsignmentThreadMarkers & {
  closedBy: string | null;
  covering: string | null;
  coveringUntil: Date | null;
};

type SeededSubject = Omit<ConsignmentThreadSubject, "covering" | "coveringUntil" | "thread">;

/** Consignment threads in memory, for service and route tests. */
export class InMemoryConsignmentMessages implements IConsignmentMessageRepository {
  readonly subjects = new Map<string, SeededSubject>();
  readonly threads = new Map<string, StoredThread>();
  readonly uploads = new Map<string, AttachableUpload & { key: string }>();
  readonly names = new Map<string, string>();
  readonly memberRoles = new Map<string, string>();
  readonly staffRoles = new Map<string, string[]>();
  readonly messages: StoredMessage[] = [];
  readonly events: Array<{
    id: string;
    submissionId: string;
    kind: ConsignmentThreadEventKind;
    actorUserId: string | null;
    subjectUserId: string | null;
    at: Date;
  }> = [];

  seedSubject(subject: SeededSubject): void {
    this.subjects.set(subject.submissionId, subject);
  }

  seedUpload(upload: AttachableUpload & { key: string }): void {
    this.uploads.set(upload.id, upload);
  }

  seedMessage(message: {
    submissionId: string;
    side: ConsignmentMessageSide;
    authorUserId: string;
    body: string;
    at: Date;
    readAt?: Date | null;
    visibility?: ConsignmentMessageVisibility;
    deliverAfter?: Date | null;
  }): string {
    const id = randomUUID();
    const visibility = message.visibility ?? "thread";
    this.moveMarkers(message.submissionId, message.side, visibility, message.at);
    this.messages.push({
      id,
      submissionId: message.submissionId,
      authorUserId: message.authorUserId,
      authorSide: message.side,
      visibility,
      body: message.body,
      createdAt: message.at,
      deliverAfter: message.deliverAfter ?? null,
      notifiedAt: null,
      readAt: message.readAt ?? null,
      attachments: [],
    });
    return id;
  }

  /** Closes a seeded thread, as staff did earlier. */
  seedClosed(submissionId: string, at: Date, by = "clara"): void {
    const thread = this.threads.get(submissionId);
    if (thread) {
      thread.closedAt = at;
      thread.closedBy = by;
    }
  }

  private person(userId: string | null | undefined, fallback: string): StaffPersonRecord | null {
    return userId ? { userId, name: this.names.get(userId) ?? fallback } : null;
  }

  async findSubject(submissionId: string): Promise<ConsignmentThreadSubject | null> {
    const subject = this.subjects.get(submissionId);
    if (!subject) return null;
    const thread = this.threads.get(submissionId);
    return {
      ...subject,
      covering: this.person(thread?.covering, "A colleague"),
      coveringUntil: thread?.covering ? (thread.coveringUntil ?? null) : null,
      thread: thread
        ? {
            id: `t-${submissionId}`,
            lastMessageAt: thread.lastMessageAt,
            lastMessageSide: thread.lastMessageSide,
            awaitingSince: thread.awaitingSince,
            closedAt: thread.closedAt,
            closedBy: this.person(thread.closedBy, "A colleague"),
          }
        : null,
    };
  }

  async listMessages(
    submissionId: string,
    audience: ConsignmentMessageAudience,
  ): Promise<ConsignmentMessageRow[]> {
    return this.messages
      .filter((m) => m.submissionId === submissionId)
      .filter(
        (m) =>
          audience.kind === "staff" ||
          (m.visibility === "thread" &&
            (m.deliverAfter === null || m.deliverAfter.getTime() <= audience.now.getTime())),
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(({ submissionId: _s, notifiedAt: _n, ...m }) => ({
        ...m,
        authorName: m.authorUserId ? (this.names.get(m.authorUserId) ?? null) : null,
        authorMemberRole:
          m.authorSide === "client" && m.authorUserId
            ? (this.memberRoles.get(m.authorUserId) ?? null)
            : null,
        authorStaffRoles:
          m.authorSide === "staff" && m.authorUserId
            ? (this.staffRoles.get(m.authorUserId) ?? [])
            : [],
      }));
  }

  async findUploads(ids: readonly string[]): Promise<AttachableUpload[]> {
    return ids.flatMap((id) => {
      const upload = this.uploads.get(id);
      return upload
        ? [{ id, ownerUserId: upload.ownerUserId, kind: upload.kind, status: upload.status }]
        : [];
    });
  }

  async append(input: NewConsignmentMessage): Promise<{ messageId: string; reopened: boolean }> {
    const reopened = this.moveMarkers(input.submissionId, input.side, input.visibility, input.at);
    if (reopened) {
      const thread = this.threads.get(input.submissionId);
      if (thread) thread.closedBy = null;
      this.recordEvent(
        input.submissionId,
        "reopened",
        input.side === "client" ? null : input.authorUserId,
        null,
        input.at,
      );
    }
    const id = randomUUID();
    this.messages.push({
      id,
      submissionId: input.submissionId,
      authorUserId: input.authorUserId,
      authorSide: input.side,
      visibility: input.visibility,
      body: input.body,
      createdAt: input.at,
      deliverAfter: input.deliverAfter,
      notifiedAt: null,
      readAt: null,
      attachments: input.attachments.map((a, i) => ({
        id: `${id}-a${i}`,
        uploadObjectId: a.uploadObjectId,
        fileName: a.fileName,
        key: this.uploads.get(a.uploadObjectId)?.key ?? "missing",
        contentType: "image/jpeg",
        byteSize: 1024,
      })),
    });
    return { messageId: id, reopened };
  }

  async markRead(input: {
    submissionId: string;
    readerSide: ConsignmentMessageSide;
    at: Date;
  }): Promise<number> {
    let marked = 0;
    for (const m of this.messages) {
      const releasedToClient =
        input.readerSide !== "client" ||
        m.deliverAfter === null ||
        m.deliverAfter.getTime() <= input.at.getTime();
      if (
        m.submissionId === input.submissionId &&
        m.authorSide === otherSide(input.readerSide) &&
        m.visibility === "thread" &&
        releasedToClient &&
        !m.readAt
      ) {
        m.readAt = input.at;
        marked++;
      }
    }
    return marked;
  }

  async markNewestClientMessageUnread(submissionId: string): Promise<boolean> {
    const newest = this.messages
      .filter((m) => m.submissionId === submissionId && m.authorSide === "client")
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    if (!newest) return false;
    newest.readAt = null;
    return true;
  }

  async deleteHeldReply(input: {
    messageId: string;
    authorUserId: string;
    now: Date;
  }): Promise<UndoHeldReplyResult> {
    const index = this.messages.findIndex((m) => m.id === input.messageId);
    const message = this.messages[index];
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
    this.messages.splice(index, 1);
    const thread = this.threads.get(message.submissionId);
    if (thread) {
      const markers = markersFromMessages(
        this.messages
          .filter((m) => m.submissionId === message.submissionId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .map((m) => ({ side: m.authorSide, visibility: m.visibility, at: m.createdAt })),
        thread.closedAt,
      );
      if (markers) Object.assign(thread, markers);
    }
    return { outcome: "deleted", submissionId: message.submissionId };
  }

  async releaseHeldReply(messageId: string, now: Date): Promise<boolean> {
    const message = this.messages.find((m) => m.id === messageId);
    if (!message) return false;
    message.deliverAfter = now;
    return true;
  }

  async claimReplyNotice(messageId: string, now: Date): Promise<ClaimedReplyNotice | null> {
    const message = this.messages.find((m) => m.id === messageId);
    if (
      !message ||
      message.notifiedAt ||
      message.authorSide !== "staff" ||
      message.visibility !== "thread" ||
      (message.deliverAfter && message.deliverAfter.getTime() > now.getTime())
    ) {
      return null;
    }
    message.notifiedAt = now;
    return {
      submissionId: message.submissionId,
      authorName: message.authorUserId
        ? (this.names.get(message.authorUserId) ?? "LAX specialist")
        : "LAX specialist",
      body: message.body,
      fileCount: message.attachments.length,
    };
  }

  async closeThread(input: {
    submissionId: string;
    actorUserId: string;
    at: Date;
  }): Promise<boolean> {
    const thread = this.threads.get(input.submissionId);
    if (!thread || thread.closedAt) return false;
    thread.closedAt = input.at;
    thread.closedBy = input.actorUserId;
    this.recordEvent(input.submissionId, "closed", input.actorUserId, null, input.at);
    return true;
  }

  async reopenThread(input: {
    submissionId: string;
    actorUserId: string;
    at: Date;
  }): Promise<boolean> {
    const thread = this.threads.get(input.submissionId);
    if (!thread?.closedAt) return false;
    thread.closedAt = null;
    thread.closedBy = null;
    this.recordEvent(input.submissionId, "reopened", input.actorUserId, null, input.at);
    return true;
  }

  async assignThread(input: AssignThreadInput): Promise<AssignThreadResult> {
    const subject = this.subjects.get(input.submissionId);
    if (!subject) return { outcome: "no_thread" };
    const thread = this.threads.get(input.submissionId);
    const target = input.assignedToUserId;
    const specialistId = subject.specialist?.userId ?? null;
    const coversOnly = input.covering && target !== null && target !== specialistId;
    if (coversOnly) {
      if (!thread) return { outcome: "no_thread" };
      if (
        thread.covering === target &&
        thread.coveringUntil?.getTime() === input.coveringUntil?.getTime()
      ) {
        return { outcome: "unchanged" };
      }
      thread.covering = target;
      thread.coveringUntil = input.coveringUntil;
      this.recordEvent(input.submissionId, "covering", input.actorUserId, target, input.at);
      return { outcome: "changed", event: "covering" };
    }
    if (specialistId === target && !thread?.covering) return { outcome: "unchanged" };
    subject.specialist = this.person(target, "A colleague");
    if (thread) {
      thread.covering = null;
      thread.coveringUntil = null;
    }
    const kind: ConsignmentThreadEventKind = target ? "assigned" : "unassigned";
    if (thread) this.recordEvent(input.submissionId, kind, input.actorUserId, target, input.at);
    return { outcome: "changed", event: thread ? kind : null };
  }

  async endElapsedCovers(now: Date): Promise<EndedCover[]> {
    const ended: EndedCover[] = [];
    for (const [submissionId, thread] of this.threads) {
      if (!thread.covering || !thread.coveringUntil) continue;
      if (thread.coveringUntil.getTime() > now.getTime()) continue;
      thread.covering = null;
      thread.coveringUntil = null;
      const specialist = this.subjects.get(submissionId)?.specialist ?? null;
      this.recordEvent(
        submissionId,
        specialist ? "assigned" : "unassigned",
        null,
        specialist?.userId ?? null,
        now,
      );
      ended.push({ submissionId, specialist });
    }
    return ended;
  }

  async listOverdueReplyNotices(cutoff: Date, limit: number): Promise<string[]> {
    return this.messages
      .filter(
        (m) =>
          !m.notifiedAt &&
          m.authorSide === "staff" &&
          m.visibility === "thread" &&
          m.deliverAfter !== null &&
          m.deliverAfter.getTime() <= cutoff.getTime(),
      )
      .sort((a, b) => (a.deliverAfter?.getTime() ?? 0) - (b.deliverAfter?.getTime() ?? 0))
      .slice(0, limit)
      .map((m) => m.id);
  }

  async listEvents(submissionId: string): Promise<ConsignmentThreadEventRecord[]> {
    return this.events
      .filter((e) => e.submissionId === submissionId)
      .map((e) => ({
        id: e.id,
        kind: e.kind,
        actor: this.person(e.actorUserId, "A colleague"),
        subject: this.person(e.subjectUserId, "A colleague"),
        at: e.at,
      }));
  }

  /** Applies the markers rule; true when it reopened a closed thread. */
  private moveMarkers(
    submissionId: string,
    side: ConsignmentMessageSide,
    visibility: ConsignmentMessageVisibility,
    at: Date,
  ): boolean {
    const current = this.threads.get(submissionId);
    const { markers, reopened } = markersAfterMessage(current ?? null, { side, visibility, at });
    this.threads.set(submissionId, {
      closedBy: current?.closedBy ?? null,
      covering: current?.covering ?? null,
      coveringUntil: current?.coveringUntil ?? null,
      ...markers,
    });
    return reopened;
  }

  private recordEvent(
    submissionId: string,
    kind: ConsignmentThreadEventKind,
    actorUserId: string | null,
    subjectUserId: string | null,
    at: Date,
  ): void {
    this.events.push({
      id: randomUUID(),
      submissionId,
      kind,
      actorUserId,
      subjectUserId,
      at,
    });
  }
}
