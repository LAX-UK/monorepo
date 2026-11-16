import type {
  EnquiryCloseReason,
  EnquiryIntent,
  EnquiryRoutingRule,
  EnquiryStatus,
  EnquiryTransitionRefusal,
  EnquiryViewer,
  InboundDkimResult,
  InboundMatchMethod,
  InboundQuarantineReason,
  InboundSpfResult,
} from "@auction/domain";
import type {
  EnquiryAttachmentRecord,
  EnquiryStatusCounts,
  InboundAttachmentMetadata,
  PrivateSaleEnquiryDetail,
  UploadOwner,
} from "@auction/persistence/interfaces";
import type {
  AdminEnquiryListQuery,
  AdminEnquiryPatch,
  EnquiryIntakeInput,
} from "@auction/validators";
import type { EnquiryAssignee } from "../marketing-enquiry/enquiry-assignee-directory.js";
import type { EnquirerAccount } from "../marketing-enquiry/enquiry-intake.mapper.js";

export type EnquiryNoteView = {
  id: string;
  authorUserId: string | null;
  body: string;
  createdAt: string;
};

/** A reply the client emailed back, as staff read it on the thread. Plain text only. */
export type EnquiryEmailReplyView = {
  id: string;
  receivedAt: string;
  subject: string;
  body: string;
  /** Name, type and size of each file; the files themselves were not kept. */
  attachments: InboundAttachmentMetadata[];
  /** `staff` when a person attached it from quarantine. */
  matchedBy: InboundMatchMethod;
  spfResult: InboundSpfResult | null;
  dkimResult: InboundDkimResult | null;
  /** Attached by staff only: why it was held before a person attached it. */
  heldReason: InboundQuarantineReason | null;
  /** Attached by staff only: the reason the person gave for attaching it. */
  reviewReason: string | null;
  /**
   * Whether it is verified as coming from this enquiry's client: from the client's address, with
   * aligned SPF or DKIM passing. Always true for a reply that joined the thread on its own.
   */
  senderVerified: boolean;
  /** Attached by staff only: it came from an address other than the client's. */
  fromOtherAddress: boolean;
};

/** What staff read when they open an enquiry. */
export type MarketingEnquiryView = {
  id: string;
  reference: string;
  intent: EnquiryIntent;
  topic: string;
  topicLabel: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  sourcePage: string | null;
  status: EnquiryStatus;
  closeReason: EnquiryCloseReason | null;
  departmentSlug: string | null;
  assignedToUserId: string | null;
  /** The signed-in account that sent it; null for a guest. */
  userId: string | null;
  legalEntityId: string | null;
  marketingOptIn: boolean;
  /** Send this back with a change; a change made against an older version is refused. */
  version: number;
  receivedAt: string;
  handledAt: string | null;
  /** When the promised reply is due: two business days after the enquiry arrived. */
  replyDueAt: string;
  /** Where the status may go next. */
  nextStatuses: EnquiryStatus[];
  privateSale: PrivateSaleEnquiryDetail | null;
  attachments: EnquiryAttachmentRecord[];
  notes: EnquiryNoteView[];
  /** The client's emailed replies, oldest first. */
  replies: EnquiryEmailReplyView[];
  /** When the client replied and nobody has answered yet; null when nothing is waiting. */
  awaitingReplySince: string | null;
};

/** A row in the Enquiries list. The email is masked; the record shows it in full. */
export type MarketingEnquiryListItem = {
  id: string;
  reference: string;
  intent: EnquiryIntent;
  topicLabel: string;
  name: string;
  maskedEmail: string;
  hasAccount: boolean;
  departmentSlug: string | null;
  assignedToUserId: string | null;
  status: EnquiryStatus;
  receivedAt: string;
  replyDueAt: string;
  /** When the client replied by email and nobody has answered yet. */
  awaitingReplySince: string | null;
  version: number;
};

export type MarketingEnquiryListPage = {
  items: MarketingEnquiryListItem[];
  nextCursor: string | null;
  /** How many enquiries sit in each status under the view and filters, apart from the status filter. */
  counts: EnquiryStatusCounts;
};

type HistoryBase = {
  id: string;
  at: string;
  actorUserId: string | null;
  /** From the identity directory; null when the person is not in it. */
  actorName: string | null;
};

/** One change to an enquiry, from the audit trail. Staff identifiers and codes only. */
export type EnquiryHistoryEntry = HistoryBase &
  (
    | {
        kind: "assigned";
        toUserId: string | null;
        fromUserId: string | null;
        toName: string | null;
        fromName: string | null;
      }
    | { kind: "status_changed"; from: string | null; to: string | null; closeReason: string | null }
    | { kind: "converted"; from: string | null }
  );

/** A short-lived link to one attachment. */
export type EnquiryAttachmentLink = {
  url: string;
  kind: "image" | "document";
  contentType: string;
  expiresInSec: number;
};

/** The person at the desk: who they are, what they may read, and whether they may hand work over. */
export type EnquiryStaffViewer = EnquiryViewer & { canAssign: boolean };

export type EnquiryUpdateError =
  | "enquiry_not_found"
  | "assign_forbidden"
  | "assignee_invalid"
  | "stale_version"
  | EnquiryTransitionRefusal
  | "close_reason_without_status";

export type EnquiryUpdateResult =
  | { ok: true; enquiry: MarketingEnquiryView }
  | { ok: false; error: EnquiryUpdateError; currentVersion?: number };

export type MarketingEnquiryHandledResult =
  | { ok: true; enquiry: MarketingEnquiryView }
  | { ok: false; error: "enquiry_not_found" | "already_handled" };

export type MarketingEnquirySubmitted = {
  id: string;
  reference: string;
  /** When the promised reply is due: two business days after the enquiry arrived (ISO time). */
  replyBy: string;
};

/** The public side: the contact form and the enquiry page hand a message to the platform. */
export interface IMarketingEnquiryIntake {
  submit(input: EnquiryIntakeInput, sender?: EnquirySender): Promise<MarketingEnquirySubmitted>;
}

/** Who sent the enquiry: their account when signed in, and whose uploaded files may be attached. */
export type EnquirySender = {
  account?: EnquirerAccount | undefined;
  uploadOwner?: UploadOwner | undefined;
};

/** The staff side: list, open and work an enquiry. */
export interface IMarketingEnquiryDesk {
  list(viewer: EnquiryStaffViewer, query: AdminEnquiryListQuery): Promise<MarketingEnquiryListPage>;
  /** An enquiry by reference or id, or null when there is none or the viewer may not see it. */
  detail(viewer: EnquiryStaffViewer, ref: string): Promise<MarketingEnquiryView | null>;
  /** Assignments and status changes, oldest first; null when there is no such enquiry to the viewer. */
  history(viewer: EnquiryStaffViewer, ref: string): Promise<EnquiryHistoryEntry[] | null>;
  /** A signed link to one attachment, under the rule for opening the enquiry; the view is audited. */
  attachmentLink(
    viewer: EnquiryStaffViewer,
    ref: string,
    attachmentId: string,
  ): Promise<EnquiryAttachmentLink | null>;
  update(
    viewer: EnquiryStaffViewer,
    actorUserId: string,
    ref: string,
    patch: AdminEnquiryPatch,
  ): Promise<EnquiryUpdateResult>;
  /** Closes an open enquiry without a reason. Kept for the existing "Mark handled" button. */
  markHandled(
    viewer: EnquiryStaffViewer,
    id: string,
    actorUserId: string,
  ): Promise<MarketingEnquiryHandledResult>;
}

export type EnquiryRoutingError = "assignee_invalid";

export type EnquiryRoutingUpdateResult =
  | { ok: true; rules: EnquiryRoutingRule[] }
  | { ok: false; error: EnquiryRoutingError; userId: string };

/** Who receives each department's enquiries. */
export interface IEnquiryRouting {
  rules(): Promise<EnquiryRoutingRule[]>;
  /** The staff an enquiry may be given to, for the assignee and routing pickers. */
  assignees(): Promise<EnquiryAssignee[]>;
  replace(
    actorUserId: string,
    rules: readonly EnquiryRoutingRule[],
  ): Promise<EnquiryRoutingUpdateResult>;
}
