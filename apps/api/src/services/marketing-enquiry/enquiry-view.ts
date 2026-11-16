import { enquiryNextStatuses, isAttachedSenderVerified } from "@auction/domain";
import { emailHash } from "@auction/email";
import type {
  EnquiryNoteRecord,
  InboundThreadMessage,
  MarketingEnquiryDetailRecord,
  MarketingEnquiryRecord,
} from "@auction/persistence/interfaces";
import { addBusinessDays } from "../admin/admin-work-item-sla.policy.js";
import type {
  EnquiryEmailReplyView,
  MarketingEnquiryListItem,
  MarketingEnquiryView,
} from "../interfaces/marketing-enquiry-service.js";

/** The reply promised on the contact page and the enquiry page. */
export const ENQUIRY_REPLY_BUSINESS_DAYS = 2;

const TOPIC_LABELS: Record<string, string> = {
  buying: "Buying",
  selling: "Selling",
  shipping: "Shipping",
  press: "Press",
  other: "Other",
};

export function enquiryTopicLabel(topic: string): string {
  return TOPIC_LABELS[topic] ?? topic;
}

const INTENT_LABELS: Record<string, string> = {
  private_sale_sell: "Sell privately",
  private_sale_buy: "Buy privately",
};

/** What kind of enquiry this is, in the words staff use. */
function kindLabel(record: MarketingEnquiryRecord): string {
  return INTENT_LABELS[record.intent] ?? enquiryTopicLabel(record.topic);
}

export function replyDueAt(record: MarketingEnquiryRecord): string {
  return addBusinessDays(record.createdAt, ENQUIRY_REPLY_BUSINESS_DAYS).toISOString();
}

/** "ada@example.com" as "a•••@example.com". */
export function maskEnquiryEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••";
  return `${email.slice(0, 1)}•••${email.slice(at)}`;
}

export function toListItem(record: MarketingEnquiryRecord): MarketingEnquiryListItem {
  return {
    id: record.id,
    reference: record.reference,
    intent: record.intent,
    topicLabel: kindLabel(record),
    name: record.name,
    maskedEmail: maskEnquiryEmail(record.email),
    hasAccount: record.userId !== null,
    departmentSlug: record.departmentSlug,
    assignedToUserId: record.assignedToUserId,
    status: record.status,
    receivedAt: record.createdAt.toISOString(),
    replyDueAt: replyDueAt(record),
    awaitingReplySince: record.awaitingReplySince?.toISOString() ?? null,
    version: record.version,
  };
}

/**
 * One emailed reply as staff read it. A reply that joined the thread on its own was already
 * matched to the client's address and authenticated; one staff attached from held mail says
 * whether it came from the client's address and whether its sender checks passed.
 */
export function toReplyView(
  reply: InboundThreadMessage,
  enquirerEmail: string,
): EnquiryEmailReplyView {
  const attached = reply.matchedBy === "staff";
  const fromOtherAddress = attached && reply.fromEmailHash !== emailHash(enquirerEmail);
  return {
    id: reply.id,
    receivedAt: reply.receivedAt.toISOString(),
    subject: reply.subject,
    body: reply.body,
    attachments: reply.attachments,
    matchedBy: reply.matchedBy,
    spfResult: reply.spfResult,
    dkimResult: reply.dkimResult,
    heldReason: attached ? reply.heldReason : null,
    reviewReason: attached ? reply.reviewReason : null,
    senderVerified:
      !attached ||
      isAttachedSenderVerified(
        {
          reason: reply.heldReason ?? "unmatched",
          spfResult: reply.spfResult,
          dkimResult: reply.dkimResult,
        },
        !fromOtherAddress,
      ),
    fromOtherAddress,
  };
}

export function toView(
  record: MarketingEnquiryRecord | MarketingEnquiryDetailRecord,
  notes: EnquiryNoteRecord[] = [],
  replies: InboundThreadMessage[] = [],
): MarketingEnquiryView {
  const detail = "privateSale" in record ? record : null;
  return {
    id: record.id,
    reference: record.reference,
    intent: record.intent,
    topic: record.topic,
    topicLabel: kindLabel(record),
    name: record.name,
    email: record.email,
    phone: record.phone,
    message: record.message,
    sourcePage: record.sourcePage,
    status: record.status,
    closeReason: record.closeReason,
    departmentSlug: record.departmentSlug,
    assignedToUserId: record.assignedToUserId,
    userId: record.userId,
    legalEntityId: record.legalEntityId,
    marketingOptIn: record.marketingOptIn,
    version: record.version,
    receivedAt: record.createdAt.toISOString(),
    handledAt: record.handledAt?.toISOString() ?? null,
    replyDueAt: replyDueAt(record),
    nextStatuses: enquiryNextStatuses(record.status),
    privateSale: detail?.privateSale ?? null,
    attachments: detail?.attachments ?? [],
    notes: notes.map((note) => ({
      id: note.id,
      authorUserId: note.authorUserId,
      body: note.body,
      createdAt: note.createdAt.toISOString(),
    })),
    replies: replies.map((reply) => toReplyView(reply, record.email)),
    awaitingReplySince: record.awaitingReplySince?.toISOString() ?? null,
  };
}
