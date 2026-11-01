import {
  type ConsignmentMessageSide,
  type EntityActor,
  consignmentMessageProblem,
  consignmentReference,
  consignmentThreadAccess,
  normaliseConsignmentMessageBody,
  threadAwaitsStaff,
} from "@auction/domain";
import type {
  ConsignmentMessageRow,
  ConsignmentThreadInboxQuery,
  ConsignmentThreadSubject,
  IConsignmentMessageRepository,
} from "@auction/persistence/interfaces";
import type {
  ConsignmentMessageView,
  IAttachmentLinks,
  IConsignmentMessageNotifier,
  IConsignmentSpecialistAssigner,
} from "./consignment-message.ports.js";

/** The upload kind a message's files are uploaded as (`upload.policy.ts`). */
export const CONSIGNMENT_MESSAGE_UPLOAD_KIND = "consignment_message_attachment";

/** A member of the account a client request acts for. */
export type ConsignmentThreadMember = {
  legalEntityId: string;
  userId: string;
  actor: EntityActor;
};

export type ConsignmentMessageDraft = {
  body: string;
  attachments: ReadonlyArray<{ uploadObjectId: string; fileName?: string | null | undefined }>;
};

export type ConsignmentMessageFailure = {
  ok: false;
  status: 400 | 403 | 404;
  code: string;
  error: string;
};
export type ConsignmentMessageOutcome<T> = { ok: true; value: T } | ConsignmentMessageFailure;

export type ClientThreadView = {
  submissionId: string;
  specialist: { name: string } | null;
  messages: ConsignmentMessageView[];
  /** The specialist's messages nobody who answers has read. */
  unread: number;
  access: { canWrite: boolean; reason: string | null };
};

export type StaffThreadView = {
  submission: { id: string; title: string; reference: string };
  account: { id: string; name: string } | null;
  specialist: { userId: string; name: string } | null;
  saleId: string | null;
  messages: ConsignmentMessageView[];
  /** Client messages LAX has not read. */
  unread: number;
  awaitingStaff: boolean;
};

export type StaffThreadRow = {
  submissionId: string;
  title: string;
  reference: string;
  account: { id: string; name: string } | null;
  specialist: { userId: string; name: string } | null;
  saleId: string | null;
  lastMessageAt: string;
  lastMessagePreview: string;
  awaitingStaff: boolean;
  unread: number;
};

export type StaffThreadListQuery = {
  view: "all" | "unanswered";
  assigned?: string | undefined;
  saleId?: string | undefined;
  limit: number;
  cursor?: string | undefined;
};

const NOT_FOUND: ConsignmentMessageFailure = {
  ok: false,
  status: 404,
  code: "not_found",
  error: "Not found",
};

const ATTACHMENT_NOT_READY: ConsignmentMessageFailure = {
  ok: false,
  status: 400,
  code: "attachment_not_ready",
  error: "A file is still being checked. Try again in a moment.",
};

const ATTACHMENT_INVALID: ConsignmentMessageFailure = {
  ok: false,
  status: 400,
  code: "attachment_invalid",
  error: "A file could not be attached. Upload it again.",
};

const PREVIEW_LENGTH = 160;

function failure(status: 400 | 403 | 404, code: string, error: string): ConsignmentMessageFailure {
  return { ok: false, status, code, error };
}

function preview(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH - 1)}…` : flat;
}

/** A page boundary for the inbox: the last row's time and consignment. */
export function encodeThreadCursor(row: { lastMessageAt: Date; submissionId: string }): string {
  return Buffer.from(`${row.lastMessageAt.toISOString()}|${row.submissionId}`).toString(
    "base64url",
  );
}

export function decodeThreadCursor(
  cursor: string | undefined,
): { lastMessageAt: Date; submissionId: string } | undefined {
  if (!cursor) return undefined;
  const [at, submissionId] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const lastMessageAt = at ? new Date(at) : null;
  if (!lastMessageAt || Number.isNaN(lastMessageAt.getTime()) || !submissionId) return undefined;
  return { lastMessageAt, submissionId };
}

export type ConsignmentMessageServiceDeps = {
  messages: IConsignmentMessageRepository;
  notifier: IConsignmentMessageNotifier;
  assigner: IConsignmentSpecialistAssigner;
  links: IAttachmentLinks;
  now?: () => Date;
};

/**
 * The use cases of consignment messages. Who reads and writes on the client side is the domain's
 * `consignmentThreadAccess`; staff access is checked before these are called. A hidden or foreign
 * consignment answers "Not found", as every other consignment endpoint does.
 */
export class ConsignmentMessageService {
  private readonly now: () => Date;

  constructor(private readonly deps: ConsignmentMessageServiceDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  async readForClient(
    member: ConsignmentThreadMember,
    submissionId: string,
  ): Promise<ConsignmentMessageOutcome<ClientThreadView>> {
    const reached = await this.reachForClient(member, submissionId);
    if (!reached.ok) return reached;
    const { subject, access } = reached.value;
    const rows = await this.deps.messages.listMessages(submissionId);
    return {
      ok: true,
      value: {
        submissionId,
        specialist: subject.specialist ? { name: subject.specialist.name } : null,
        messages: await this.present(rows),
        unread: rows.filter((row) => row.authorSide === "staff" && !row.readAt).length,
        access: access.write.allowed
          ? { canWrite: true, reason: null }
          : { canWrite: false, reason: access.write.message },
      },
    };
  }

  async writeForClient(
    member: ConsignmentThreadMember,
    submissionId: string,
    draft: ConsignmentMessageDraft,
  ): Promise<ConsignmentMessageOutcome<ConsignmentMessageView>> {
    const reached = await this.reachForClient(member, submissionId);
    if (!reached.ok) return reached;
    const { subject, access } = reached.value;
    if (!access.write.allowed) {
      return failure(403, `cannot_write_${access.write.reason}`, access.write.message);
    }
    const written = await this.write(subject, "client", member.userId, draft);
    if (!written.ok) return written;
    // Writing answers the specialist, so what they wrote has been read.
    await this.deps.messages.markRead({ submissionId, readerSide: "client", at: this.now() });
    await this.deps.notifier.clientWrote(written.value.notice);
    return { ok: true, value: written.value.message };
  }

  async markReadForClient(
    member: ConsignmentThreadMember,
    submissionId: string,
  ): Promise<ConsignmentMessageOutcome<{ marked: number }>> {
    const reached = await this.reachForClient(member, submissionId);
    if (!reached.ok) return reached;
    // A viewer reading along, or support staff, leaves the task with the people who answer.
    if (!reached.value.access.marksRead) return { ok: true, value: { marked: 0 } };
    const marked = await this.deps.messages.markRead({
      submissionId,
      readerSide: "client",
      at: this.now(),
    });
    return { ok: true, value: { marked } };
  }

  async listForStaff(
    staffUserId: string,
    query: StaffThreadListQuery,
  ): Promise<{ rows: StaffThreadRow[]; nextCursor: string | null }> {
    const assigned: ConsignmentThreadInboxQuery["assigned"] =
      query.assigned === "me"
        ? { kind: "user", userId: staffUserId }
        : query.assigned === "unassigned"
          ? { kind: "unassigned" }
          : query.assigned
            ? { kind: "user", userId: query.assigned }
            : undefined;
    const rows = await this.deps.messages.listThreadsForStaff({
      awaitingStaff: query.view === "unanswered",
      assigned,
      saleId: query.saleId,
      limit: query.limit + 1,
      before: decodeThreadCursor(query.cursor),
    });
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      rows: page.map((row) => ({
        submissionId: row.submissionId,
        title: row.title,
        reference: consignmentReference(row.referenceNumber),
        account: row.account,
        specialist: row.specialist,
        saleId: row.saleId,
        lastMessageAt: row.lastMessageAt.toISOString(),
        lastMessagePreview: preview(row.lastMessageBody),
        awaitingStaff: threadAwaitsStaff(row.lastMessageSide),
        unread: row.unreadForStaff,
      })),
      nextCursor: rows.length > query.limit && last ? encodeThreadCursor(last) : null,
    };
  }

  async readForStaff(submissionId: string): Promise<ConsignmentMessageOutcome<StaffThreadView>> {
    const subject = await this.deps.messages.findSubject(submissionId);
    if (!subject) return NOT_FOUND;
    const rows = await this.deps.messages.listMessages(submissionId);
    const last = rows.at(-1);
    return {
      ok: true,
      value: {
        submission: {
          id: subject.submissionId,
          title: subject.title,
          reference: consignmentReference(subject.referenceNumber),
        },
        account: subject.account ? { id: subject.account.id, name: subject.account.name } : null,
        specialist: subject.specialist,
        saleId: subject.saleId,
        messages: await this.present(rows),
        unread: rows.filter((row) => row.authorSide === "client" && !row.readAt).length,
        awaitingStaff: threadAwaitsStaff(last?.authorSide ?? null),
      },
    };
  }

  async writeForStaff(
    staffUserId: string,
    submissionId: string,
    draft: ConsignmentMessageDraft,
  ): Promise<ConsignmentMessageOutcome<ConsignmentMessageView>> {
    const subject = await this.deps.messages.findSubject(submissionId);
    if (!subject) return NOT_FOUND;
    const written = await this.write(subject, "staff", staffUserId, draft);
    if (!written.ok) return written;
    await this.deps.messages.markRead({ submissionId, readerSide: "staff", at: this.now() });
    await this.deps.notifier.specialistWrote(written.value.notice);
    return { ok: true, value: written.value.message };
  }

  async assign(
    staffUserId: string,
    submissionId: string,
    assignedToUserId: string | null,
  ): Promise<ConsignmentMessageOutcome<{ specialist: { userId: string; name: string } | null }>> {
    const subject = await this.deps.messages.findSubject(submissionId);
    if (!subject) return NOT_FOUND;
    const result = await this.deps.assigner.assign({
      staffUserId,
      submissionId,
      assignedToUserId,
    });
    if (!result.ok) {
      const status = result.status === 404 ? 404 : result.status === 403 ? 403 : 400;
      return failure(status, "assign_refused", result.message);
    }
    const after = await this.deps.messages.findSubject(submissionId);
    return { ok: true, value: { specialist: after?.specialist ?? null } };
  }

  async markReadForStaff(
    submissionId: string,
  ): Promise<ConsignmentMessageOutcome<{ marked: number }>> {
    const subject = await this.deps.messages.findSubject(submissionId);
    if (!subject) return NOT_FOUND;
    const marked = await this.deps.messages.markRead({
      submissionId,
      readerSide: "staff",
      at: this.now(),
    });
    return { ok: true, value: { marked } };
  }

  /** The consignment is the account's and the member may see it; with their access to its thread. */
  private async reachForClient(member: ConsignmentThreadMember, submissionId: string) {
    const subject = await this.deps.messages.findSubject(submissionId);
    if (!subject || subject.account?.id !== member.legalEntityId) return NOT_FOUND;
    const access = consignmentThreadAccess({
      actor: { userId: member.userId, member: member.actor },
      submission: subject,
      organisationStatus: subject.account.kind === "organisation" ? subject.account.status : null,
    });
    if (!access.read) return NOT_FOUND;
    return { ok: true as const, value: { subject, access } };
  }

  /** Checks and stores a message; returns it as read back, with the notice it calls for. */
  private async write(
    subject: ConsignmentThreadSubject,
    side: ConsignmentMessageSide,
    authorUserId: string,
    draft: ConsignmentMessageDraft,
  ) {
    const attachmentIds = draft.attachments.map((a) => a.uploadObjectId);
    const problem = consignmentMessageProblem({ body: draft.body, attachmentIds });
    if (problem) return failure(400, problem.code, problem.message);
    const refused = await this.checkUploads(authorUserId, attachmentIds);
    if (refused) return refused;
    const body = normaliseConsignmentMessageBody(draft.body);
    const { messageId } = await this.deps.messages.append({
      submissionId: subject.submissionId,
      authorUserId,
      side,
      body,
      at: this.now(),
      attachments: draft.attachments.map((a) => ({
        uploadObjectId: a.uploadObjectId,
        fileName: a.fileName?.trim() || null,
      })),
    });
    const rows = await this.deps.messages.listMessages(subject.submissionId);
    const row = rows.find((r) => r.id === messageId);
    if (!row) throw new Error("consignment message was not read back");
    const [message] = await this.present([row]);
    if (!message) throw new Error("consignment message was not presented");
    return {
      ok: true as const,
      value: {
        message,
        notice: {
          subject,
          authorName: message.author.name,
          body,
          fileCount: row.attachments.length,
        },
      },
    };
  }

  /** Each file was uploaded by the author for a message, and has passed its checks. */
  private async checkUploads(
    authorUserId: string,
    ids: readonly string[],
  ): Promise<ConsignmentMessageFailure | null> {
    if (ids.length === 0) return null;
    const uploads = await this.deps.messages.findUploads(ids);
    const byId = new Map(uploads.map((upload) => [upload.id, upload]));
    for (const id of ids) {
      const upload = byId.get(id);
      if (
        !upload ||
        upload.ownerUserId !== authorUserId ||
        upload.kind !== CONSIGNMENT_MESSAGE_UPLOAD_KIND
      ) {
        return ATTACHMENT_INVALID;
      }
      if (upload.status !== "active") {
        return upload.status === "rejected" ? ATTACHMENT_INVALID : ATTACHMENT_NOT_READY;
      }
    }
    return null;
  }

  private async present(rows: readonly ConsignmentMessageRow[]): Promise<ConsignmentMessageView[]> {
    const keys = rows.flatMap((row) => row.attachments.map((a) => a.key));
    const links = keys.length > 0 ? await this.deps.links.linksFor(keys) : [];
    let next = 0;
    return rows.map((row) => ({
      id: row.id,
      side: row.authorSide,
      author: {
        userId: row.authorUserId,
        name: row.authorName ?? (row.authorSide === "staff" ? "LAX specialist" : "A member"),
      },
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt ? row.readAt.toISOString() : null,
      attachments: row.attachments.map((a) => {
        const url = links[next++] ?? "";
        return {
          id: a.id,
          fileName: a.fileName ?? fileNameFromKey(a.key),
          contentType: a.contentType,
          byteSize: a.byteSize,
          url,
        };
      }),
    }));
  }
}

/** A readable name when the sender's device gave none: "Photo.jpg", "Document.pdf". */
function fileNameFromKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  return ext === "pdf" ? "Document.pdf" : ext ? `Photo.${ext}` : "File";
}
