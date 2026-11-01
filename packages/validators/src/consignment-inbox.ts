import {
  CONSIGNMENT_INBOX_SORTS,
  CONSIGNMENT_INBOX_VIEWS,
  CONSIGNMENT_MESSAGE_MAX_LENGTH,
  CONSIGNMENT_MESSAGE_VISIBILITIES,
  type ConsignmentInboxSort,
  type ConsignmentInboxView,
  type ConsignmentMessageSide,
  type ConsignmentMessageVisibility,
  type ConsignmentThreadStatus,
  type ReplyClockState,
  SAVED_REPLY_TITLE_MAX_LENGTH,
} from "@auction/domain";
import { z } from "zod";
import { postConsignmentMessageBodySchema } from "./consignment-message.js";

/**
 * The Bid admin inbox for consignment messages: requests the API accepts and the shapes it
 * answers with. Bid web reads the same types, so both sides change together.
 */

/** A comma-separated list in a query string ("a,b"), as an array of distinct values. */
const idList = z
  .string()
  .max(2000)
  .transform((raw) => [
    ...new Set(
      raw
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ])
  .pipe(z.array(z.string().min(1).max(191)).max(50));

/** Filters every inbox read shares: the list, its counts and the bulk actions by filter. */
export const consignmentInboxFilterSchema = z.object({
  view: z.enum(CONSIGNMENT_INBOX_VIEWS).default("unanswered"),
  /** Reference ("NB-2041"), work title, client or person name, or words in a message. */
  q: z.string().trim().max(200).optional(),
  /** Assignee user ids, or `unassigned`. */
  specialist: idList.optional(),
  /** Sale ids, or `none` for consignments not in a sale. */
  sale: idList.optional(),
  /** Organisation (legal entity) ids, or `private` for private sellers. */
  organisation: idList.optional(),
});
export type ConsignmentInboxFilter = z.infer<typeof consignmentInboxFilterSchema>;

export const consignmentInboxListQuerySchema = consignmentInboxFilterSchema.extend({
  sort: z.enum(CONSIGNMENT_INBOX_SORTS).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});
export type ConsignmentInboxListQuery = z.infer<typeof consignmentInboxListQuerySchema>;

export const consignmentThreadReplyBodySchema = postConsignmentMessageBodySchema.extend({
  visibility: z.enum(CONSIGNMENT_MESSAGE_VISIBILITIES).default("thread"),
  /**
   * The newest message the writer had on screen. When the client has written since, the reply
   * is held (409 `thread_changed`) with what is new, unless `sendAnyway` is set.
   */
  lastSeenMessageId: z.string().uuid().nullable().optional(),
  sendAnyway: z.boolean().default(false),
});
export type ConsignmentThreadReplyBody = z.infer<typeof consignmentThreadReplyBodySchema>;

export const consignmentThreadMessageParamSchema = z.object({
  submissionId: z.string().uuid(),
  messageId: z.string().uuid(),
});

export const consignmentThreadAssignBodySchema = z
  .object({
    /** The new owner, or null to leave the consignment unassigned. */
    assignedToUserId: z.string().min(1).max(191).nullable(),
    /**
     * Cover this thread only (a colleague on leave): the consignment keeps its specialist. Ending
     * cover is assigning back to the specialist.
     */
    covering: z.boolean().default(false),
  })
  .strict();
export type ConsignmentThreadAssignBody = z.infer<typeof consignmentThreadAssignBodySchema>;

export const consignmentInboxBulkBodySchema = z
  .object({
    action: z.enum(["assign", "mark_read", "close"]),
    /** The chosen threads, by consignment; or `filter` for every thread the list matches. */
    submissionIds: z.array(z.string().uuid()).min(1).max(200).optional(),
    filter: consignmentInboxFilterSchema.optional(),
    assignedToUserId: z.string().min(1).max(191).nullable().optional(),
  })
  .strict()
  .refine((body) => Boolean(body.submissionIds) !== Boolean(body.filter), {
    message: "Choose threads or a filter, not both.",
  })
  .refine((body) => body.action !== "assign" || body.assignedToUserId !== undefined, {
    message: "Choose who to assign the threads to.",
    path: ["assignedToUserId"],
  });
export type ConsignmentInboxBulkBody = z.infer<typeof consignmentInboxBulkBodySchema>;

export const savedReplyBodySchema = z
  .object({
    title: z.string().trim().min(1).max(SAVED_REPLY_TITLE_MAX_LENGTH),
    body: z.string().trim().min(1).max(CONSIGNMENT_MESSAGE_MAX_LENGTH),
  })
  .strict();
export type SavedReplyBody = z.infer<typeof savedReplyBodySchema>;

export const savedReplyParamSchema = z.object({ id: z.string().uuid() });

// ---------------------------------------------------------------------------------------------
// Responses
// ---------------------------------------------------------------------------------------------

export type StaffPersonRef = { userId: string; name: string };

/** Who has a thread; `covering` when it is a colleague standing in for the specialist. */
export type ConsignmentThreadAssigneeView = StaffPersonRef & { covering: boolean };

/** How long the client has waited and when the answer is due, in working time. */
export type ConsignmentReplyClockView = {
  state: ReplyClockState;
  waitingSince: string;
  dueAt: string;
  waitedMinutes: number;
  remainingMinutes: number;
  overdueMinutes: number;
};

export type ConsignmentInboxRow = {
  submissionId: string;
  title: string;
  reference: string;
  /** The first photo of the work, ready to show; null without one. */
  imageUrl: string | null;
  /** The sale it is in, or null: the second line under the reference. */
  sale: { id: string; name: string } | null;
  account: { id: string; name: string; kind: "individual" | "organisation" } | null;
  /** The account member who wrote most recently (or sent the work). */
  clientPerson: { name: string } | null;
  lastMessage: {
    side: ConsignmentMessageSide;
    authorFirstName: string;
    excerpt: string;
    hasAttachment: boolean;
    at: string;
  };
  status: ConsignmentThreadStatus;
  /** Client messages nobody at LAX has read. */
  unread: boolean;
  /** Only while the thread waits on LAX. */
  clock: ConsignmentReplyClockView | null;
  assignee: ConsignmentThreadAssigneeView | null;
};

export type ConsignmentInboxFacet = { id: string; label: string; count: number };

export type ConsignmentInboxListResponse = {
  data: ConsignmentInboxRow[];
  total: number;
  /** The view and sort the server applied (the defaults when the request named none). */
  view: ConsignmentInboxView;
  sort: ConsignmentInboxSort;
  /** Counts for each filter's checklist, under the view and search but not that filter. */
  facets: {
    specialist: ConsignmentInboxFacet[];
    sale: ConsignmentInboxFacet[];
    organisation: ConsignmentInboxFacet[];
  };
};

/** The one reader behind the view tabs, the sidebar count and the Dashboard queues. */
export type ConsignmentInboxSummary = {
  /** Every open thread waiting on LAX. */
  unanswered: number;
  /** Threads the viewer has that wait on LAX: the sidebar count. */
  mine: { waiting: number; overdue: number; oldestWaitingSince: string | null };
  /** Threads waiting on LAX whose consignment has nobody. */
  unassigned: {
    waiting: number;
    oldestWaitingSince: string | null;
    /** The client of the oldest, for "Cedar & Stone Fine Art · waiting 4 hours". */
    oldestAccountName: string | null;
  };
};

export type ConsignmentThreadAttachmentView = {
  id: string;
  fileName: string;
  contentType: string | null;
  byteSize: number | null;
  url: string;
};

export type ConsignmentThreadMessageView = {
  id: string;
  side: ConsignmentMessageSide;
  visibility: ConsignmentMessageVisibility;
  author: {
    userId: string | null;
    name: string;
    /** "Modern British specialist", "Northbank Gallery, consignor". */
    role: string | null;
  };
  body: string;
  createdAt: string;
  /** When the other side first read it (never set on notes). */
  readAt: string | null;
  /** A staff reply the writer can still take back, until this time. */
  undoUntil: string | null;
  attachments: ConsignmentThreadAttachmentView[];
};

export type ConsignmentThreadEventKind =
  | "assigned"
  | "unassigned"
  | "covering"
  | "closed"
  | "reopened";

export type ConsignmentThreadEventView = {
  id: string;
  kind: ConsignmentThreadEventKind;
  actor: StaffPersonRef | null;
  /** The person assigned or covering. */
  subject: StaffPersonRef | null;
  at: string;
};

export type ConsignmentThreadFacts = {
  /** The submission's stage, as a status key the admin presents ("approved", "converted"). */
  stage: string;
  artistLine: string | null;
  sale: { id: string; name: string; startsAt: string | null } | null;
  /** The lot, with its state and whether it sold, so the stage reads as the consignment's step. */
  lot: { id: string; number: number | null; status: string; sold: boolean } | null;
  estimate: { low: string | null; high: string | null; currency: string } | null;
  reserve: { amount: string; currency: string } | null;
  agreement: {
    state: "proposed" | "accepted";
    proposedAt: string;
    acceptedAt: string | null;
  } | null;
};

export type ConsignmentThreadPeople = {
  /** The member who sent the work. */
  sender: { name: string; role: string } | null;
  /** Others who hear of a reply: the account's owners and admins. */
  alsoNotified: string[];
  /** Consignments the account has sent, for "Organisation · 14 consignments". */
  accountConsignmentCount: number;
};

export type ConsignmentThreadDetail = {
  submission: { id: string; title: string; reference: string; imageUrl: string | null };
  account: { id: string; name: string; kind: "individual" | "organisation" } | null;
  facts: ConsignmentThreadFacts;
  people: ConsignmentThreadPeople;
  specialist: StaffPersonRef | null;
  assignee: ConsignmentThreadAssigneeView | null;
  status: ConsignmentThreadStatus;
  closed: { at: string; by: StaffPersonRef | null } | null;
  clock: ConsignmentReplyClockView | null;
  messages: ConsignmentThreadMessageView[];
  events: ConsignmentThreadEventView[];
  /** Client messages nobody at LAX has read. */
  unread: number;
  /** The newest message id, sent back with a reply for the changed-while-you-wrote check. */
  lastMessageId: string | null;
  abilities: { canReply: boolean; canAssign: boolean; canClose: boolean };
};

/** 409 on a reply: the client wrote since the writer last looked. */
export type ConsignmentThreadChangedResponse = {
  error: string;
  code: "thread_changed";
  newMessages: ConsignmentThreadMessageView[];
};

export type ConsignmentAssignableStaff = StaffPersonRef & {
  /** The staff role shown under the name, as a role key ("specialist"). */
  staffRole: string | null;
  /** Open threads they have now. */
  openCount: number;
};

export type SavedReplyView = {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
  updatedBy: StaffPersonRef | null;
};

export type ConsignmentInboxBulkResult = { changed: number; skipped: number };

/** Why an attachment could not be uploaded, with the limit it broke, so the message names it. */
export const CONSIGNMENT_ATTACHMENT_REJECTION_CODES = [
  "attachment_type",
  "attachment_too_large",
  "attachment_too_many",
] as const;
export type ConsignmentAttachmentRejectionCode =
  (typeof CONSIGNMENT_ATTACHMENT_REJECTION_CODES)[number];
