import type {
  AdminEnquiryDetail,
  AdminEnquiryListItem,
  AdminEnquiryNote,
  AdminEnquirySummary,
  EnquiryAssignee,
  EnquiryKind,
  EnquiryStatus,
  EnquiryTopic,
} from "@auction/shop-contracts";
import type { EnquiryInboxCursor } from "../enquiry-inbox-cursor.js";

export type EnquiryInboxFilters = {
  kind?: EnquiryKind;
  topic?: EnquiryTopic;
  status?: EnquiryStatus;
  /** `unassigned`, or the identity subject of the staff member the enquiry is assigned to. */
  assignee?: { type: "unassigned" } | { type: "subject"; subject: string };
  /** Free text matched against sender name, sender email and message. */
  q?: string;
};

export type ListEnquiriesInput = {
  filters: EnquiryInboxFilters;
  cursor: EnquiryInboxCursor | null;
  limit: number;
};

export type EnquiryInboxPage = {
  items: AdminEnquiryListItem[];
  nextCursor: EnquiryInboxCursor | null;
  counts: Record<EnquiryStatus, number>;
};

export type UpdateEnquiryInput = {
  kind: EnquiryKind;
  id: string;
  expectedVersion: string;
  status?: EnquiryStatus;
  /** Null unassigns; undefined leaves the assignee alone. Already checked to be active staff. */
  assigneeSubject?: string | null;
  actorSubjectId: string;
};

export type UpdateEnquiryOutcome =
  | { status: "updated"; version: string }
  | { status: "not_found" }
  | { status: "stale"; currentVersion: string };

export type AddEnquiryNoteInput = {
  kind: EnquiryKind;
  id: string;
  body: string;
  authorSubjectId: string;
};

export type EnquiryInboxRepository = {
  list(input: ListEnquiriesInput): Promise<EnquiryInboxPage>;
  summary(): Promise<AdminEnquirySummary>;
  /** Null when the enquiry does not exist, or is a notify-me signup rather than an enquiry. */
  getDetail(kind: EnquiryKind, id: string): Promise<AdminEnquiryDetail | null>;
  update(input: UpdateEnquiryInput): Promise<UpdateEnquiryOutcome>;
  /** Null when the enquiry does not exist. */
  addNote(input: AddEnquiryNoteInput): Promise<AdminEnquiryNote | null>;
  /** Active staff whose role can act on enquiries. */
  listAssignees(): Promise<EnquiryAssignee[]>;
};
