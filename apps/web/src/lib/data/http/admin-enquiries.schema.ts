import {
  ENQUIRY_BUDGET_BANDS,
  ENQUIRY_CLOSE_REASONS,
  ENQUIRY_CONTACT_PREFERENCES,
  ENQUIRY_INTENTS,
  ENQUIRY_STATUSES,
  ENQUIRY_TIMINGS,
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
  version: z.number(),
});
export type EnquiryListItem = z.infer<typeof enquiryListItemSchema>;

export const enquiryListPageSchema = z.object({
  items: z.array(enquiryListItemSchema),
  nextCursor: z.string().nullable(),
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
