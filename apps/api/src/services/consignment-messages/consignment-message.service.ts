import { consignmentThreadAccess } from "@auction/domain";
import type { IConsignmentMessageRepository } from "@auction/persistence/interfaces";
import type { ConsignmentMessageComposer } from "./consignment-message-composer.js";
import type { ConsignmentMessagePresenter } from "./consignment-message-presenter.js";
import type {
  ConsignmentMessageView,
  IConsignmentMessageNotifier,
} from "./consignment-message.ports.js";
import {
  type ConsignmentMessageDraft,
  type ConsignmentMessageOutcome,
  type ConsignmentThreadMember,
  NOT_FOUND,
  failure,
} from "./consignment-message.shared.js";
import type { ConsignmentThreadAudit } from "./consignment-thread-audit.js";

export {
  CONSIGNMENT_MESSAGE_UPLOAD_KIND,
  type ConsignmentMessageDraft,
  type ConsignmentMessageFailure,
  type ConsignmentMessageOutcome,
  type ConsignmentThreadMember,
} from "./consignment-message.shared.js";

export type ClientThreadView = {
  submissionId: string;
  specialist: { name: string } | null;
  messages: ConsignmentMessageView[];
  /** The specialist's messages nobody who answers has read. */
  unread: number;
  access: { canWrite: boolean; reason: string | null };
};

export type ConsignmentMessageServiceDeps = {
  messages: IConsignmentMessageRepository;
  composer: ConsignmentMessageComposer;
  presenter: ConsignmentMessagePresenter;
  notifier: IConsignmentMessageNotifier;
  audit: ConsignmentThreadAudit;
  now?: () => Date;
};

/**
 * The account's side of consignment messages. Who reads and writes is the domain's
 * `consignmentThreadAccess`. A hidden or foreign consignment answers "Not found", as every other
 * consignment endpoint does. The account never sees internal notes, nor a staff reply until its
 * short hold has ended.
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
    const rows = await this.deps.messages.listMessages(submissionId, {
      kind: "client",
      now: this.now(),
    });
    return {
      ok: true,
      value: {
        submissionId,
        specialist: subject.specialist ? { name: subject.specialist.name } : null,
        messages: await this.deps.presenter.forClient(rows),
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
    const at = this.now();
    const composed = await this.deps.composer.compose({
      subject,
      side: "client",
      visibility: "thread",
      authorUserId: member.userId,
      draft,
      at,
      deliverAfter: null,
    });
    if (!composed.ok) return composed;
    // Writing answers the specialist, so what they wrote has been read.
    await this.deps.messages.markRead({ submissionId, readerSide: "client", at });
    // A message on a closed thread reopens it; whoever has the thread is told either way.
    const [view] = await this.deps.presenter.forClient([composed.value.row]);
    if (!view) throw new Error("consignment message was not presented");
    if (composed.value.reopened) {
      await this.deps.audit.threadChanged({ kind: "reopened", submissionId, actorUserId: null });
    }
    await this.deps.notifier.clientWrote({
      subject,
      authorName: view.author.name,
      body: composed.value.body,
      fileCount: composed.value.row.attachments.length,
    });
    return { ok: true, value: view };
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
}
