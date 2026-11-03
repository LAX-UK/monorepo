import { enquiryNextStatuses } from "@auction/domain";
import type {
  EnquiryNoteRecord,
  MarketingEnquiryDetailRecord,
  MarketingEnquiryRecord,
} from "@auction/persistence/interfaces";
import { addBusinessDays } from "../admin/admin-work-item-sla.policy.js";
import type {
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
    version: record.version,
  };
}

export function toView(
  record: MarketingEnquiryRecord | MarketingEnquiryDetailRecord,
  notes: EnquiryNoteRecord[] = [],
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
  };
}
