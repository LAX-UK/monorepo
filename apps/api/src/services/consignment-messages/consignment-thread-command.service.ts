import { CONSIGNMENT_REPLY_UNDO_MS, coverEndError, messagesSinceSeen } from "@auction/domain";
import type {
  ConsignmentInboxQueryFilter,
  IConsignmentInboxReader,
  IConsignmentMessageRepository,
  IConsignmentStaffDirectory,
} from "@auction/persistence/interfaces";
import { CONSIGNMENT_INBOX_REPLY_ACCESS, type StaffRoles, userHasAccessTo } from "@auction/types";
import type {
  ConsignmentInboxBulkBody,
  ConsignmentInboxBulkResult,
  ConsignmentThreadAssignBody,
  ConsignmentThreadAssigneeView,
  ConsignmentThreadMessageView,
  ConsignmentThreadReplyBody,
} from "@auction/validators";
import type { ConsignmentMessageComposer } from "./consignment-message-composer.js";
import type { ConsignmentMessagePresenter } from "./consignment-message-presenter.js";
import type {
  IConsignmentAssignment,
  IConsignmentMessageNotifier,
  IConsignmentReplyDelivery,
} from "./consignment-message.ports.js";
import {
  type ConsignmentMessageOutcome,
  NOT_FOUND,
  assigneeView,
  failure,
} from "./consignment-message.shared.js";
import type { ConsignmentThreadAudit } from "./consignment-thread-audit.js";

/** The cap on threads one bulk action may change. */
export const BULK_ACTION_LIMIT = 200;

const NO_CONVERSATION = failure(409, "no_thread", "There are no messages on this consignment yet.");

export type ConsignmentThreadCommandDeps = {
  messages: IConsignmentMessageRepository;
  inbox: Pick<IConsignmentInboxReader, "findSubmissionIds">;
  staff: IConsignmentStaffDirectory;
  composer: ConsignmentMessageComposer;
  presenter: ConsignmentMessagePresenter;
  notifier: IConsignmentMessageNotifier;
  delivery: IConsignmentReplyDelivery;
  audit: ConsignmentThreadAudit;
  assignment: IConsignmentAssignment;
  now?: () => Date;
};

/**
 * What staff do to a thread: reply (held for a few seconds so it can be taken back), leave a
 * note, close, reopen, mark read or unread, and hand it to someone. Permission is checked before
 * these run; each use case here is one change the history records.
 */
export class ConsignmentThreadCommandService {
  private readonly now: () => Date;

  constructor(private readonly deps: ConsignmentThreadCommandDeps) {
    this.now = deps.now ?? (() => new Date());
  }

  /** A reply to the account, or an internal note when `body.visibility` says so. */
  async reply(
    staffUserId: string,
    submissionId: string,
    body: ConsignmentThreadReplyBody,
  ): Promise<ConsignmentMessageOutcome<ConsignmentThreadMessageView>> {
    const subject = await this.deps.messages.findSubject(submissionId);
    if (!subject) return NOT_FOUND;
    const at = this.now();
    const isNote = body.visibility === "internal";

    if (!isNote) {
      const changed = await this.newSinceSeen(staffUserId, submissionId, body, at, subject.account);
      if (changed) return changed;
    }

    const deliverAfter = isNote ? null : new Date(at.getTime() + CONSIGNMENT_REPLY_UNDO_MS);
    const composed = await this.deps.composer.compose({
      subject,
      side: "staff",
      visibility: body.visibility,
      authorUserId: staffUserId,
      draft: body,
      at,
      deliverAfter,
    });
    if (!composed.ok) return composed;
    let row = composed.value.row;

    if (!isNote) {
      // Answering reads what the client wrote.
      await this.deps.messages.markRead({ submissionId, readerSide: "staff", at });
      if (composed.value.reopened) {
        await this.deps.audit.threadChanged({
          kind: "reopened",
          submissionId,
          actorUserId: staffUserId,
        });
      }
      if (deliverAfter && !(await this.scheduleDelivery(row.id, deliverAfter, at))) {
        // The queue is away: the reply goes now, with no time to take it back.
        row = { ...row, deliverAfter: at };
      }
    }

    const [view] = await this.deps.presenter.forStaff([row], {
      viewerUserId: staffUserId,
      accountName: subject.account?.name ?? null,
      now: at,
    });
    if (!view) throw new Error("consignment message was not presented");
    return { ok: true, value: view };
  }

  /** Takes back the writer's own reply while it is still held. */
  async undo(
    staffUserId: string,
    submissionId: string,
    messageId: string,
  ): Promise<ConsignmentMessageOutcome<{ undone: true }>> {
    const subject = await this.deps.messages.findSubject(submissionId);
    if (!subject) return NOT_FOUND;
    const rows = await this.deps.messages.listMessages(submissionId, { kind: "staff" });
    if (!rows.some((row) => row.id === messageId)) return NOT_FOUND;
    const result = await this.deps.messages.deleteHeldReply({
      messageId,
      authorUserId: staffUserId,
      now: this.now(),
    });
    if (result.outcome === "not_found") {
      return failure(409, "undo_expired", "The reply has already gone to the client.");
    }
    if (result.outcome === "expired") {
      return failure(409, "undo_expired", "The reply has already gone to the client.");
    }
    await this.deps.delivery.cancel(messageId).catch(() => undefined);
    return { ok: true, value: { undone: true } };
  }

  async close(
    staffUserId: string,
    submissionId: string,
  ): Promise<ConsignmentMessageOutcome<{ changed: boolean }>> {
    const subject = await this.deps.messages.findSubject(submissionId);
    if (!subject) return NOT_FOUND;
    if (!subject.thread) return NO_CONVERSATION;
    const changed = await this.deps.messages.closeThread({
      submissionId,
      actorUserId: staffUserId,
      at: this.now(),
    });
    if (changed) {
      await this.deps.audit.threadChanged({
        kind: "closed",
        submissionId,
        actorUserId: staffUserId,
      });
    }
    return { ok: true, value: { changed } };
  }

  async reopen(
    staffUserId: string,
    submissionId: string,
  ): Promise<ConsignmentMessageOutcome<{ changed: boolean }>> {
    const subject = await this.deps.messages.findSubject(submissionId);
    if (!subject) return NOT_FOUND;
    if (!subject.thread) return NO_CONVERSATION;
    const changed = await this.deps.messages.reopenThread({
      submissionId,
      actorUserId: staffUserId,
      at: this.now(),
    });
    if (changed) {
      await this.deps.audit.threadChanged({
        kind: "reopened",
        submissionId,
        actorUserId: staffUserId,
      });
    }
    return { ok: true, value: { changed } };
  }

  async markRead(submissionId: string): Promise<ConsignmentMessageOutcome<{ marked: number }>> {
    const subject = await this.deps.messages.findSubject(submissionId);
    if (!subject) return NOT_FOUND;
    const marked = await this.deps.messages.markRead({
      submissionId,
      readerSide: "staff",
      at: this.now(),
    });
    return { ok: true, value: { marked } };
  }

  async markUnread(submissionId: string): Promise<ConsignmentMessageOutcome<{ changed: boolean }>> {
    const subject = await this.deps.messages.findSubject(submissionId);
    if (!subject) return NOT_FOUND;
    const changed = await this.deps.messages.markNewestClientMessageUnread(submissionId);
    return { ok: true, value: { changed } };
  }

  /** Gives the thread (and the consignment) to a colleague, or covers it for the specialist. */
  async assign(
    staffUserId: string,
    submissionId: string,
    body: ConsignmentThreadAssignBody,
  ): Promise<
    ConsignmentMessageOutcome<{ changed: boolean; assignee: ConsignmentThreadAssigneeView | null }>
  > {
    const subject = await this.deps.messages.findSubject(submissionId);
    if (!subject) return NOT_FOUND;
    if (body.covering && !body.assignedToUserId) {
      return failure(400, "covering_needs_person", "Choose who is covering this thread.");
    }
    const coveringUntil = body.coveringUntil ? new Date(body.coveringUntil) : null;
    const badEnd = coveringUntil ? coverEndError(coveringUntil, this.now()) : null;
    if (badEnd) return failure(400, "cover_end_invalid", badEnd);
    const ineligible = await this.checkAssignee(body.assignedToUserId);
    if (ineligible) return ineligible;
    const outcome = await this.deps.assignment.assign(staffUserId, submissionId, {
      assignedToUserId: body.assignedToUserId,
      covering: body.covering,
      coveringUntil,
    });
    if (outcome === "no_thread") return NO_CONVERSATION;
    const after = await this.deps.messages.findSubject(submissionId);
    return {
      ok: true,
      value: {
        changed: outcome === "changed",
        assignee: after ? assigneeView(after) : null,
      },
    };
  }

  /** One action on many threads, chosen by id or by the list's filter. */
  async bulk(
    staffUserId: string,
    body: ConsignmentInboxBulkBody,
    filter: ConsignmentInboxQueryFilter | null,
  ): Promise<ConsignmentMessageOutcome<ConsignmentInboxBulkResult>> {
    if (body.action === "assign") {
      const ineligible = await this.checkAssignee(body.assignedToUserId ?? null);
      if (ineligible) return ineligible;
    }
    const ids = body.submissionIds
      ? [...new Set(body.submissionIds)]
      : filter
        ? await this.deps.inbox.findSubmissionIds(filter, BULK_ACTION_LIMIT)
        : [];
    let changed = 0;
    for (const submissionId of ids.slice(0, BULK_ACTION_LIMIT)) {
      if (await this.applyBulk(staffUserId, submissionId, body)) changed++;
    }
    return { ok: true, value: { changed, skipped: ids.length - changed } };
  }

  /**
   * The hold on a staff reply has ended: tells the account, once. Safe to run twice, and does
   * nothing for a reply taken back in the meantime.
   */
  async deliver(messageId: string): Promise<boolean> {
    const notice = await this.deps.messages.claimReplyNotice(messageId, this.now());
    if (!notice) return false;
    const subject = await this.deps.messages.findSubject(notice.submissionId);
    if (!subject) return false;
    await this.deps.notifier.specialistWrote({
      subject,
      authorName: notice.authorName,
      body: notice.body,
      fileCount: notice.fileCount,
    });
    return true;
  }

  private async applyBulk(
    staffUserId: string,
    submissionId: string,
    body: ConsignmentInboxBulkBody,
  ): Promise<boolean> {
    const subject = await this.deps.messages.findSubject(submissionId);
    if (!subject) return false;
    switch (body.action) {
      case "mark_read":
        return (
          (await this.deps.messages.markRead({
            submissionId,
            readerSide: "staff",
            at: this.now(),
          })) > 0
        );
      case "close": {
        const closed = await this.deps.messages.closeThread({
          submissionId,
          actorUserId: staffUserId,
          at: this.now(),
        });
        if (closed) {
          await this.deps.audit.threadChanged({
            kind: "closed",
            submissionId,
            actorUserId: staffUserId,
          });
        }
        return closed;
      }
      case "assign":
        return (
          (await this.deps.assignment.assign(staffUserId, submissionId, {
            assignedToUserId: body.assignedToUserId ?? null,
            covering: false,
          })) === "changed"
        );
    }
  }

  /** The person must be active staff who answer client messages. */
  private async checkAssignee(userId: string | null) {
    if (!userId) return null;
    const member = await this.deps.staff.findActiveStaff(userId, this.now());
    if (!member || !canReply(member.roles)) {
      return failure(
        400,
        "assignee_not_eligible",
        "Choose a colleague who answers client messages.",
      );
    }
    return null;
  }

  /** Holds the reply back when the client has written since the writer last looked. */
  private async newSinceSeen(
    staffUserId: string,
    submissionId: string,
    body: ConsignmentThreadReplyBody,
    at: Date,
    account: { name: string } | null,
  ) {
    if (!body.lastSeenMessageId || body.sendAnyway) return null;
    const rows = await this.deps.messages.listMessages(submissionId, { kind: "staff" });
    const visible = rows
      .filter((row) => row.visibility === "thread")
      .map((row) => ({ ...row, side: row.authorSide }));
    const unseen = messagesSinceSeen(visible, body.lastSeenMessageId);
    if (unseen.length === 0) return null;
    const newMessages = await this.deps.presenter.forStaff(unseen, {
      viewerUserId: staffUserId,
      accountName: account?.name ?? null,
      now: at,
    });
    return failure(
      409,
      "thread_changed",
      "The client wrote while you were typing. Read what is new, then send.",
      { newMessages },
    );
  }

  /** Schedules the notice; false when it could not be and the reply was released instead. */
  private async scheduleDelivery(messageId: string, at: Date, now: Date): Promise<boolean> {
    try {
      await this.deps.delivery.schedule(messageId, at);
      return true;
    } catch (error) {
      console.error("[consignment-reply] could not schedule the delivery; sending now", error);
      await this.deps.messages.releaseHeldReply(messageId, now);
      await this.deliver(messageId);
      return false;
    }
  }
}

function canReply(roles: StaffRoles): boolean {
  return userHasAccessTo("staff", roles, CONSIGNMENT_INBOX_REPLY_ACCESS);
}
