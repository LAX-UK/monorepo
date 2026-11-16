import {
  ERASED_ENQUIRY,
  canViewEnquiry,
  isAttachedSenderVerified,
  quarantineReviewRefusal,
} from "@auction/domain";
import { emailHash } from "@auction/email";
import type {
  IEnquiryInboundRepository,
  IEnquiryQuarantineReviewRepository,
  IMarketingEnquiryRepository,
  ITransactionRunner,
  QuarantineScope,
  QuarantinedMessageRecord,
  QuarantinedMessageSummary,
} from "@auction/persistence/interfaces";
import type {
  AdminEnquiryQuarantineAttach,
  AdminEnquiryQuarantineDiscard,
  AdminEnquiryQuarantineListQuery,
} from "@auction/validators";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type {
  IEnquiryQuarantineDesk,
  QuarantineAttachResult,
  QuarantineDiscardResult,
  QuarantineListItemView,
  QuarantineListPage,
  QuarantineMessageView,
} from "../interfaces/enquiry-quarantine.js";
import type { EnquiryStaffViewer } from "../interfaces/marketing-enquiry-service.js";

export type EnquiryQuarantineServiceDeps = {
  quarantine: IEnquiryQuarantineReviewRepository;
  /** Files an attached message on its thread and marks the thread awaiting a reply. */
  inbound: Pick<
    IEnquiryInboundRepository,
    | "lockTargetInTransaction"
    | "insertInboundMessageInTransaction"
    | "markAwaitingReplyInTransaction"
  >;
  enquiries: Pick<IMarketingEnquiryRepository, "findByRef">;
  transactionRunner: ITransactionRunner;
  events: IDomainEventSink;
  now: () => Date;
};

/** A position in the held-mail list: the arrival time and id of the last row on the page. */
export function encodeQuarantineCursor(row: { receivedAt: Date; id: string }): string {
  return Buffer.from(`${row.receivedAt.toISOString()}|${row.id}`).toString("base64url");
}

/** The position a cursor names, or null when it is not one we issued. */
export function decodeQuarantineCursor(cursor: string): { receivedAt: Date; id: string } | null {
  const [at, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const receivedAt = at ? new Date(at) : null;
  if (!receivedAt || Number.isNaN(receivedAt.getTime())) return null;
  return id && /^[0-9a-f-]{36}$/i.test(id) ? { receivedAt, id } : null;
}

const scopeOf = (viewer: EnquiryStaffViewer): QuarantineScope => ({
  readsGeneral: viewer.readsGeneral,
  readsPrivateSale: viewer.readsPrivateSale,
});

function toListItem(row: QuarantinedMessageSummary): QuarantineListItemView {
  return {
    id: row.id,
    reason: row.reason,
    status: row.status,
    fromAddress: row.fromAddress,
    subject: row.subject,
    attachmentCount: row.attachmentCount,
    suspectedEnquiry: row.suspectedEnquiry
      ? { reference: row.suspectedEnquiry.reference, intent: row.suspectedEnquiry.intent }
      : null,
    receivedAt: row.receivedAt.toISOString(),
    purgeAt: row.purgeAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
  };
}

function toMessage(row: QuarantinedMessageRecord): QuarantineMessageView {
  return {
    ...toListItem(row),
    body: row.body,
    attachments: row.attachments,
    spfResult: row.spfResult,
    dkimResult: row.dkimResult,
  };
}

const QUARANTINE = "enquiry_inbound_quarantine" as const;

/**
 * Staff review of held inbound mail. A held mail is attached to exactly one enquiry (the one its
 * reply address named, or one a person picks), or discarded; either happens once, under a row
 * lock, with an audited event naming who did it and the reason they gave. A mail whose sender is
 * not verified as the enquiry's client is attached only when the person confirms it, keeps why it
 * was held on the thread, and is never filed on an erased enquiry. Nothing here changes what was
 * received; events carry ids, codes and the reason staff typed.
 */
export class EnquiryQuarantineService implements IEnquiryQuarantineDesk {
  constructor(private readonly deps: EnquiryQuarantineServiceDeps) {}

  async list(
    viewer: EnquiryStaffViewer,
    query: AdminEnquiryQuarantineListQuery,
  ): Promise<QuarantineListPage> {
    const scope = scopeOf(viewer);
    const [rows, pendingCount] = await Promise.all([
      this.deps.quarantine.list({
        scope,
        view: query.view,
        after: query.cursor ? decodeQuarantineCursor(query.cursor) : null,
        limit: query.limit,
      }),
      this.deps.quarantine.countPending(scope),
    ]);
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      items: page.map(toListItem),
      nextCursor: rows.length > query.limit && last ? encodeQuarantineCursor(last) : null,
      pendingCount,
    };
  }

  async detail(viewer: EnquiryStaffViewer, id: string): Promise<QuarantineMessageView | null> {
    const row = await this.deps.quarantine.findById(id, scopeOf(viewer));
    return row ? toMessage(row) : null;
  }

  async attach(
    viewer: EnquiryStaffViewer,
    id: string,
    input: AdminEnquiryQuarantineAttach,
  ): Promise<QuarantineAttachResult> {
    const held = await this.deps.quarantine.findById(id, scopeOf(viewer));
    if (!held) return { ok: false, error: "quarantine_not_found" };
    if (!viewer.canAssign) return { ok: false, error: "review_forbidden" };
    const target = await this.deps.enquiries.findByRef(input.enquiryReference);
    if (!target || !canViewEnquiry(target, viewer))
      return { ok: false, error: "enquiry_not_found" };
    // An enquiry erased at the sender's request takes no new personal text.
    if (target.email === ERASED_ENQUIRY.email) return { ok: false, error: "enquiry_erased" };

    type Outcome =
      | { ok: true; messageId: string }
      | {
          ok: false;
          error:
            | "already_reviewed"
            | "sender_confirmation_required"
            | "enquiry_not_found"
            | "enquiry_erased";
        };
    const result = await this.deps.transactionRunner.runInTransaction(
      async (tx): Promise<Outcome> => {
        // Read the enquiry again under a row lock, before the held mail (erasure takes the
        // enquiry first too): an erasure that committed after the check above is seen here, and
        // one that starts now waits for this transaction and then removes what it filed.
        const enquiry = await this.deps.inbound.lockTargetInTransaction(tx, target.id);
        if (!enquiry) return { ok: false, error: "enquiry_not_found" };
        if (enquiry.email === ERASED_ENQUIRY.email) return { ok: false, error: "enquiry_erased" };
        const locked = await this.deps.quarantine.lockInTransaction(tx, id);
        if (!locked || quarantineReviewRefusal(locked.status))
          return { ok: false, error: "already_reviewed" };
        const fromMatchesEnquirer =
          locked.fromAddress.trim().toLowerCase() === enquiry.email.trim().toLowerCase();
        const senderVerified = isAttachedSenderVerified(locked, fromMatchesEnquirer);
        // A sender who is not verified as this enquiry's client is attached only on purpose.
        if (!senderVerified && !input.confirmSenderNotVerified) {
          return { ok: false, error: "sender_confirmation_required" };
        }
        const message = await this.deps.inbound.insertInboundMessageInTransaction(tx, {
          enquiryId: target.id,
          providerMessageId: locked.providerMessageId,
          matchedBy: "staff",
          fromEmailHash: emailHash(locked.fromAddress),
          subject: locked.subject,
          body: locked.body,
          attachments: locked.attachments,
          spfResult: locked.spfResult ?? "none",
          dkimResult: locked.dkimResult ?? "none",
          heldReason: locked.reason,
          reviewReason: input.reason,
        });
        if (!message) return { ok: false, error: "already_reviewed" };
        const at = this.deps.now();
        await this.deps.inbound.markAwaitingReplyInTransaction(tx, target.id, at);
        await this.deps.quarantine.markReviewedInTransaction(tx, id, {
          status: "linked",
          byUserId: viewer.userId,
          at,
        });
        await this.deps.events.withTx(tx).publish({
          aggregateType: "marketing_enquiry",
          aggregateId: target.id,
          eventType: "marketing_enquiry.inbound_attached",
          payload: {
            enquiryId: target.id,
            intent: target.intent,
            quarantineId: id,
            messageId: message.id,
            reason: locked.reason,
            suspectedEnquiry: locked.suspectedEnquiry?.id === target.id,
            attachmentCount: locked.attachments.length,
            spfResult: locked.spfResult,
            dkimResult: locked.dkimResult,
            senderVerified,
            reviewReason: input.reason,
          },
          actorUserId: viewer.userId,
        });
        return { ok: true, messageId: message.id };
      },
    );
    if (!result.ok) return result;
    return { ok: true, enquiryReference: target.reference, messageId: result.messageId };
  }

  async discard(
    viewer: EnquiryStaffViewer,
    id: string,
    input: AdminEnquiryQuarantineDiscard,
  ): Promise<QuarantineDiscardResult> {
    const held = await this.deps.quarantine.findById(id, scopeOf(viewer));
    if (!held) return { ok: false, error: "quarantine_not_found" };
    if (!viewer.canAssign) return { ok: false, error: "review_forbidden" };

    const discarded = await this.deps.transactionRunner.runInTransaction(async (tx) => {
      const locked = await this.deps.quarantine.lockInTransaction(tx, id);
      if (!locked || quarantineReviewRefusal(locked.status)) return false;
      await this.deps.quarantine.markReviewedInTransaction(tx, id, {
        status: "dismissed",
        byUserId: viewer.userId,
        at: this.deps.now(),
      });
      await this.deps.events.withTx(tx).publish({
        aggregateType: QUARANTINE,
        aggregateId: id,
        eventType: "marketing_enquiry.inbound_discarded",
        payload: { quarantineId: id, reason: locked.reason, reviewReason: input.reason },
        actorUserId: viewer.userId,
      });
      return true;
    });
    return discarded ? { ok: true } : { ok: false, error: "already_reviewed" };
  }
}
