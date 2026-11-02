import type {
  EnquiryCloseReason,
  EnquiryIntent,
  EnquiryRoutingRule,
  EnquiryStatus,
  EnquiryTransitionRefusal,
  EnquiryViewer,
} from "@auction/domain";
import type {
  EnquiryAttachmentRecord,
  PrivateSaleEnquiryDetail,
} from "@auction/persistence/interfaces";
import type {
  AdminEnquiryListQuery,
  AdminEnquiryPatch,
  EnquiryIntakeInput,
} from "@auction/validators";
import type { EnquirerAccount } from "../marketing-enquiry/enquiry-intake.mapper.js";

export type EnquiryNoteView = {
  id: string;
  authorUserId: string | null;
  body: string;
  createdAt: string;
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
  version: number;
};

export type MarketingEnquiryListPage = {
  items: MarketingEnquiryListItem[];
  nextCursor: string | null;
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

export type MarketingEnquirySubmitted = { id: string; reference: string };

/** The public side: the contact form and the enquiry page hand a message to the platform. */
export interface IMarketingEnquiryIntake {
  submit(input: EnquiryIntakeInput, account?: EnquirerAccount): Promise<MarketingEnquirySubmitted>;
}

/** The staff side: list, open and work an enquiry. */
export interface IMarketingEnquiryDesk {
  list(viewer: EnquiryStaffViewer, query: AdminEnquiryListQuery): Promise<MarketingEnquiryListPage>;
  /** An enquiry by reference or id, or null when there is none or the viewer may not see it. */
  detail(viewer: EnquiryStaffViewer, ref: string): Promise<MarketingEnquiryView | null>;
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
  replace(
    actorUserId: string,
    rules: readonly EnquiryRoutingRule[],
  ): Promise<EnquiryRoutingUpdateResult>;
}
