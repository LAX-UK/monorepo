import type {
  CreateDataRequestInput,
  DataRequestChannel,
  DataRequestError,
  DataRequestListQuery,
  DataRequestOutcome,
  DataRequestProduct,
  DataRequestReason,
  DataRequestRecord,
  DataRequestSummary,
} from "@auction/identity-contracts";
import type { SubjectExportRow } from "./subject-export.ports.js";

export type ManualRequestStatus = "waiting_for_id" | "in_progress" | "closed";

/** One manual request as Identity stores it. Dates are London calendar dates (`YYYY-MM-DD`). */
export type ManualRequestRow = {
  id: string;
  reference: string;
  /** Null for a person with no account, or if the user row was ever deleted. */
  subjectId: string | null;
  contactName: string | null;
  contactDetail: string | null;
  contactClearedAt: Date | null;
  reason: DataRequestReason;
  channel: DataRequestChannel;
  products: DataRequestProduct[];
  productGathered: Partial<Record<DataRequestProduct, { at: string; by: string }>>;
  receivedOn: string;
  clockStartedOn: string | null;
  dueOn: string | null;
  extendedDueOn: string | null;
  extensionReason: string | null;
  extensionNote: string | null;
  personToldOn: string | null;
  personToldVia: string | null;
  status: ManualRequestStatus;
  outcome: DataRequestOutcome | null;
  outcomeNote: string | null;
  complaintRightTold: boolean | null;
  closedOn: string | null;
  closedBy: string | null;
  linkedExportId: string | null;
  notes: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

/** The audit vocabulary for manual requests; the deadline alert is a download event and lives with those. */
export const DATA_REQUEST_AUDIT_EVENTS = [
  "data_request.logged",
  "data_request.notes_edited",
  "data_request.scope_changed",
  "data_request.contact_edited",
  "data_request.product_gathered",
  "data_request.product_ungathered",
  "data_request.clock_started",
  "data_request.extended",
  "data_request.closed",
  "data_request.contact_cleared",
] as const;
export type DataRequestAuditEvent = (typeof DATA_REQUEST_AUDIT_EVENTS)[number];

/** Ids, dates and codes. Never notes, names or contact details. */
export type DataRequestAuditEntry = {
  event: DataRequestAuditEvent;
  detail?: Record<string, string | number | boolean | string[] | null>;
};

/** The columns a change may set; everything else about a request is fixed once logged. */
export type ManualRequestChange = Partial<
  Pick<
    ManualRequestRow,
    | "contactName"
    | "contactDetail"
    | "products"
    | "productGathered"
    | "clockStartedOn"
    | "dueOn"
    | "extendedDueOn"
    | "extensionReason"
    | "extensionNote"
    | "personToldOn"
    | "personToldVia"
    | "status"
    | "outcome"
    | "outcomeNote"
    | "complaintRightTold"
    | "closedOn"
    | "closedBy"
    | "notes"
  >
>;

export type Refusal = { ok: false; error: DataRequestError };

/** What a rule decided for a manual request: the change and its audit rows, or why not. */
export type ManualDecision =
  | { ok: true; change: ManualRequestChange; audit: DataRequestAuditEntry[] }
  | Refusal;

export type NewManualRequest = Omit<
  ManualRequestRow,
  "id" | "reference" | "contactClearedAt" | "createdAt" | "updatedAt" | "version"
>;

/** A manual request created from a download that is delayed or failed. */
export type ContinuationPlan = {
  request: NewManualRequest;
  audit: DataRequestAuditEntry[];
  /** Written to the download's own audit trail in the same transaction. */
  exportAudit: { event: "data_export.continued_manually"; detail: Record<string, string> };
};

export type ContinuationDecision = { ok: true; plan: ContinuationPlan } | Refusal;

export type MutateOutcome = { ok: true; row: ManualRequestRow } | Refusal;

/** Writes. Each change is applied under a row lock with its audit rows in the same transaction. */
export interface DataRequestWriter {
  create(request: NewManualRequest, audit: DataRequestAuditEntry[]): Promise<ManualRequestRow>;
  /** Locks the request, lets `decide` look at its current state, and applies what it returns. */
  mutate(
    reference: string,
    actorSubjectId: string,
    decide: (row: ManualRequestRow) => ManualDecision,
  ): Promise<MutateOutcome | null>;
  /** The same for a download: locks it, and `decide` also sees whether it was continued already. */
  continueDownload(
    downloadReference: string,
    actorSubjectId: string,
    decide: (download: SubjectExportRow, alreadyContinued: boolean) => ContinuationDecision,
  ): Promise<MutateOutcome | null>;
  /** Clears the contact fields of requests closed on or before `closedOnOrBefore`; returns the references. */
  clearContacts(closedOnOrBefore: string, now: Date, limit: number): Promise<string[]>;
}

/** One row of the merged list: a download or a manual request, classified once in the query. */
export type MergedRequestRow = {
  kind: "download" | "manual";
  reference: string;
  subjectId: string | null;
  email: string | null;
  contactDetail: string | null;
  status: string;
  reason: DataRequestReason | null;
  channel: DataRequestChannel | null;
  products: DataRequestProduct[];
  productsDone: number;
  requestedOn: string;
  /** The date that counts: the extended one when there is one. */
  dueOn: string | null;
  extended: boolean;
  outcome: DataRequestOutcome | null;
  /** The day a manual request was closed, or the day a download became ready. */
  answeredOn: string | null;
  /** Reference of the manual request that took a download over. */
  continuedAs: string | null;
  open: boolean;
};

/** Where the next page starts: after the row with this sort key and reference. */
export type ListPosition = { key: string; reference: string };

export type MergedListFilter = Omit<DataRequestListQuery, "cursor"> & {
  /** The London day, for the Overdue view. */
  today: string;
  limit: number;
  after?: ListPosition;
};

export type AccountFacts = {
  id: string;
  name: string;
  email: string;
  joinedOn: string;
  status: string;
};

export type AuditTimelineRow = {
  at: Date;
  event: string;
  actorSubjectId: string | null;
  userAgent: string | null;
  detail: Record<string, unknown>;
};

/** Everything the record page reads about one request. */
export type RecordSource = {
  summary: MergedRequestRow;
  manual: ManualRequestRow | null;
  download: SubjectExportRow | null;
  /** The download a manual request continues, as its reference. */
  continuedFrom: string | null;
  account: AccountFacts | null;
  timeline: AuditTimelineRow[];
  actorNames: Map<string, string>;
  /** Records collected per product, from the download's audit rows. */
  collectedRecords: Partial<Record<DataRequestProduct, number>>;
};

/** Reads. A separate port from the writer, so a reader cannot change a request. */
export interface DataRequestReader {
  list(filter: MergedListFilter): Promise<MergedRequestRow[]>;
  summary(today: string): Promise<DataRequestSummary>;
  /** Null when there is no such request; `ambiguous_reference` when a download reference matches two. */
  findRecord(reference: string): Promise<RecordSource | null | "ambiguous_reference">;
  accountExists(subjectId: string): Promise<boolean>;
}

export type { CreateDataRequestInput, DataRequestRecord };
