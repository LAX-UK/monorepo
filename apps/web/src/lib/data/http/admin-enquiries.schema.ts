import {
  ENQUIRY_BUDGET_BANDS,
  ENQUIRY_CLOSE_REASONS,
  ENQUIRY_CONTACT_PREFERENCES,
  ENQUIRY_INTENTS,
  ENQUIRY_STATUSES,
  ENQUIRY_TIMINGS,
  INBOUND_DKIM_RESULTS,
  INBOUND_MATCH_METHODS,
  INBOUND_QUARANTINE_REASONS,
  INBOUND_QUARANTINE_STATUSES,
  INBOUND_SPF_RESULTS,
} from "@auction/domain";
import { z } from "zod";

/** What the staff Enquiries routes answer with. Browser-safe: no server-only imports. */
const intent = z.enum(ENQUIRY_INTENTS);
const status = z.enum(ENQUIRY_STATUSES);

export const enquiryListItemSchema = z.object({
  id: z.string(),
  reference: z.string(),
  intent,
  topicLabel: z.string(),
  name: z.string(),
  maskedEmail: z.string(),
  hasAccount: z.boolean(),
  departmentSlug: z.string().nullable(),
  assignedToUserId: z.string().nullable(),
  status,
  receivedAt: z.string(),
  replyDueAt: z.string(),
  /** When the client replied by email and nobody has answered yet. */
  awaitingReplySince: z.string().nullable(),
  version: z.number(),
});
export type EnquiryListItem = z.infer<typeof enquiryListItemSchema>;

export const enquiryStatusCountsSchema = z.object(
  Object.fromEntries(ENQUIRY_STATUSES.map((value) => [value, z.number()])) as Record<
    (typeof ENQUIRY_STATUSES)[number],
    z.ZodNumber
  >,
);
export type EnquiryStatusCounts = z.infer<typeof enquiryStatusCountsSchema>;

export const enquiryListPageSchema = z.object({
  items: z.array(enquiryListItemSchema),
  nextCursor: z.string().nullable(),
  /** Per status, under the view and filters apart from the status filter. */
  counts: enquiryStatusCountsSchema,
});
export type EnquiryListPage = z.infer<typeof enquiryListPageSchema>;

const privateSaleDetailSchema = z.object({
  artist: z.string().nullable(),
  title: z.string().nullable(),
  medium: z.string().nullable(),
  size: z.string().nullable(),
  locationTown: z.string().nullable(),
  locationCountry: z.string().nullable(),
  priceInMindMinor: z.number().nullable(),
  lookingFor: z.string().nullable(),
  budgetBand: z.enum(ENQUIRY_BUDGET_BANDS).nullable(),
  timing: z.enum(ENQUIRY_TIMINGS).nullable(),
  contactPreference: z.enum(ENQUIRY_CONTACT_PREFERENCES),
});
export type EnquiryPrivateSaleDetail = z.infer<typeof privateSaleDetailSchema>;

export const enquiryNoteSchema = z.object({
  id: z.string(),
  authorUserId: z.string().nullable(),
  body: z.string(),
  createdAt: z.string(),
});
export type EnquiryNote = z.infer<typeof enquiryNoteSchema>;

/** Name, type and size of a file an email carried; the file itself was not kept. */
export const inboundFileSchema = z.object({
  name: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
});
export type InboundFile = z.infer<typeof inboundFileSchema>;

const spfResult = z.enum(INBOUND_SPF_RESULTS).nullable();
const dkimResult = z.enum(INBOUND_DKIM_RESULTS).nullable();

/** A reply the client emailed back. Plain text only. */
export const enquiryEmailReplySchema = z.object({
  id: z.string(),
  receivedAt: z.string(),
  subject: z.string(),
  body: z.string(),
  attachments: z.array(inboundFileSchema),
  matchedBy: z.enum(INBOUND_MATCH_METHODS),
  spfResult,
  dkimResult,
  /** Attached by staff only: why it was held, and the reason the person gave. */
  heldReason: z.enum(INBOUND_QUARANTINE_REASONS).nullable(),
  reviewReason: z.string().nullable(),
  /** False when staff attached it and its sender is not verified as the client. */
  senderVerified: z.boolean(),
  fromOtherAddress: z.boolean(),
});
export type EnquiryEmailReply = z.infer<typeof enquiryEmailReplySchema>;

export const enquiryViewSchema = z.object({
  id: z.string(),
  reference: z.string(),
  intent,
  topic: z.string(),
  topicLabel: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  message: z.string(),
  sourcePage: z.string().nullable(),
  status,
  closeReason: z.enum(ENQUIRY_CLOSE_REASONS).nullable(),
  departmentSlug: z.string().nullable(),
  assignedToUserId: z.string().nullable(),
  userId: z.string().nullable(),
  legalEntityId: z.string().nullable(),
  marketingOptIn: z.boolean(),
  version: z.number(),
  receivedAt: z.string(),
  handledAt: z.string().nullable(),
  replyDueAt: z.string(),
  nextStatuses: z.array(status),
  privateSale: privateSaleDetailSchema.nullable(),
  attachments: z.array(
    z.object({
      id: z.string(),
      uploadObjectId: z.string(),
      kind: z.enum(["image", "document"]),
      position: z.number(),
    }),
  ),
  notes: z.array(enquiryNoteSchema),
  /** The client's emailed replies, oldest first. */
  replies: z.array(enquiryEmailReplySchema),
  /** When the client replied and nobody has answered yet. */
  awaitingReplySince: z.string().nullable(),
});
export type EnquiryView = z.infer<typeof enquiryViewSchema>;

export const enquiryAssigneeSchema = z.object({ id: z.string(), name: z.string() });
export type EnquiryAssignee = z.infer<typeof enquiryAssigneeSchema>;
export const enquiryAssigneesSchema = z.object({ assignees: z.array(enquiryAssigneeSchema) });

export const enquiryRuleSchema = z.object({
  departmentSlug: z.string().nullable(),
  assignedToUserId: z.string(),
});
export type EnquiryRule = z.infer<typeof enquiryRuleSchema>;
export const enquiryRoutingSchema = z.object({ rules: z.array(enquiryRuleSchema) });

const historyBase = {
  id: z.string(),
  at: z.string(),
  actorUserId: z.string().nullable(),
  actorName: z.string().nullable(),
};

/** One assignment or status change from the audit trail. */
export const enquiryHistoryEntrySchema = z.discriminatedUnion("kind", [
  z.object({
    ...historyBase,
    kind: z.literal("assigned"),
    toUserId: z.string().nullable(),
    fromUserId: z.string().nullable(),
    toName: z.string().nullable(),
    fromName: z.string().nullable(),
  }),
  z.object({
    ...historyBase,
    kind: z.literal("status_changed"),
    from: z.string().nullable(),
    to: z.string().nullable(),
    closeReason: z.string().nullable(),
  }),
  z.object({ ...historyBase, kind: z.literal("converted"), from: z.string().nullable() }),
]);
export type EnquiryHistoryEntry = z.infer<typeof enquiryHistoryEntrySchema>;
export const enquiryHistorySchema = z.object({ entries: z.array(enquiryHistoryEntrySchema) });

/** A signed link to one attachment: good for about a minute. */
export const enquiryAttachmentLinkSchema = z.object({
  url: z.string().url(),
  kind: z.enum(["image", "document"]),
  contentType: z.string(),
  expiresInSec: z.number(),
});
export type EnquiryAttachmentLink = z.infer<typeof enquiryAttachmentLinkSchema>;

/** Held inbound mail in the staff list. */
export const quarantineListItemSchema = z.object({
  id: z.string(),
  reason: z.enum(INBOUND_QUARANTINE_REASONS),
  status: z.enum(INBOUND_QUARANTINE_STATUSES),
  fromAddress: z.string(),
  subject: z.string(),
  attachmentCount: z.number(),
  suspectedEnquiry: z.object({ reference: z.string(), intent }).nullable(),
  receivedAt: z.string(),
  purgeAt: z.string(),
  reviewedAt: z.string().nullable(),
});
export type QuarantineListItem = z.infer<typeof quarantineListItemSchema>;

export const quarantineListPageSchema = z.object({
  items: z.array(quarantineListItemSchema),
  nextCursor: z.string().nullable(),
  pendingCount: z.number(),
});
export type QuarantineListPage = z.infer<typeof quarantineListPageSchema>;

/** One held mail in full: plain text and the metadata of its files. */
export const quarantineMessageSchema = quarantineListItemSchema.extend({
  body: z.string(),
  attachments: z.array(inboundFileSchema),
  spfResult,
  dkimResult,
});
export type QuarantineMessage = z.infer<typeof quarantineMessageSchema>;

export const quarantineAttachedSchema = z.object({
  enquiryReference: z.string(),
  messageId: z.string(),
});
export type QuarantineAttached = z.infer<typeof quarantineAttachedSchema>;
