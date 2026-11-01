import { type ConsignmentMessageSide, otherSide } from "@auction/domain";
import type {
  AttachableUpload,
  ConsignmentMessageRow,
  ConsignmentThreadInboxQuery,
  ConsignmentThreadSubject,
  ConsignmentThreadSummaryRow,
  IConsignmentMessageRepository,
  NewConsignmentMessage,
} from "@auction/persistence/interfaces";

type StoredMessage = Omit<ConsignmentMessageRow, "authorName"> & { submissionId: string };

/** Consignment threads in memory, for service and route tests. */
export class InMemoryConsignmentMessages implements IConsignmentMessageRepository {
  readonly subjects = new Map<string, ConsignmentThreadSubject>();
  readonly uploads = new Map<string, AttachableUpload & { key: string }>();
  readonly names = new Map<string, string>();
  readonly messages: StoredMessage[] = [];
  private next = 1;

  seedSubject(subject: ConsignmentThreadSubject): void {
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
  }): string {
    const id = `m${this.next++}`;
    this.messages.push({
      id,
      submissionId: message.submissionId,
      authorUserId: message.authorUserId,
      authorSide: message.side,
      body: message.body,
      createdAt: message.at,
      readAt: message.readAt ?? null,
      attachments: [],
    });
    return id;
  }

  async findSubject(submissionId: string): Promise<ConsignmentThreadSubject | null> {
    return this.subjects.get(submissionId) ?? null;
  }

  async listMessages(submissionId: string): Promise<ConsignmentMessageRow[]> {
    return this.messages
      .filter((m) => m.submissionId === submissionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(({ submissionId: _s, ...m }) => ({
        ...m,
        authorName: m.authorUserId ? (this.names.get(m.authorUserId) ?? null) : null,
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

  async append(input: NewConsignmentMessage): Promise<{ messageId: string }> {
    const id = `m${this.next++}`;
    this.messages.push({
      id,
      submissionId: input.submissionId,
      authorUserId: input.authorUserId,
      authorSide: input.side,
      body: input.body,
      createdAt: input.at,
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
    return { messageId: id };
  }

  async markRead(input: {
    submissionId: string;
    readerSide: ConsignmentMessageSide;
    at: Date;
  }): Promise<number> {
    let marked = 0;
    for (const m of this.messages) {
      if (
        m.submissionId === input.submissionId &&
        m.authorSide === otherSide(input.readerSide) &&
        !m.readAt
      ) {
        m.readAt = input.at;
        marked++;
      }
    }
    return marked;
  }

  async listThreadsForStaff(
    query: ConsignmentThreadInboxQuery,
  ): Promise<ConsignmentThreadSummaryRow[]> {
    const rows: ConsignmentThreadSummaryRow[] = [];
    for (const subject of this.subjects.values()) {
      const thread = this.messages
        .filter((m) => m.submissionId === subject.submissionId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      const last = thread.at(-1);
      if (!last) continue;
      rows.push({
        submissionId: subject.submissionId,
        title: subject.title,
        referenceNumber: subject.referenceNumber,
        account: subject.account ? { id: subject.account.id, name: subject.account.name } : null,
        specialist: subject.specialist,
        saleId: subject.saleId,
        lastMessageAt: last.createdAt,
        lastMessageSide: last.authorSide,
        lastMessageBody: last.body,
        unreadForStaff: thread.filter((m) => m.authorSide === "client" && !m.readAt).length,
      });
    }
    return rows
      .filter((row) => !query.awaitingStaff || row.lastMessageSide === "client")
      .filter((row) =>
        query.assigned?.kind === "user"
          ? row.specialist?.userId === query.assigned.userId
          : query.assigned?.kind === "unassigned"
            ? row.specialist === null
            : true,
      )
      .filter((row) => !query.saleId || row.saleId === query.saleId)
      .filter(
        (row) =>
          !query.before ||
          row.lastMessageAt < query.before.lastMessageAt ||
          (row.lastMessageAt.getTime() === query.before.lastMessageAt.getTime() &&
            row.submissionId < query.before.submissionId),
      )
      .sort(
        (a, b) =>
          b.lastMessageAt.getTime() - a.lastMessageAt.getTime() ||
          b.submissionId.localeCompare(a.submissionId),
      )
      .slice(0, query.limit);
  }
}
