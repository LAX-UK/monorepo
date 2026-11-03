import type { SubjectExportProduct, SubjectExportStatus } from "@auction/identity-contracts";

export type SubjectExportProductState = "waiting" | "collecting" | "done" | "retrying";
export type SubjectExportProgressMap = Record<SubjectExportProduct, SubjectExportProductState>;

/** One request as Identity stores it. The object key stays inside Identity. */
export type SubjectExportRow = {
  id: string;
  /** Null once the user row has been hard-deleted; the request is kept as a record. */
  subjectId: string | null;
  status: SubjectExportStatus;
  productProgress: SubjectExportProgressMap;
  requestedAt: Date;
  dueAt: Date;
  readyAt: Date | null;
  expiresAt: Date | null;
  deletedAt: Date | null;
  objectKey: string | null;
  fileName: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  downloadCount: number;
  lastErrorCode: string | null;
  deadlineAlertTier: number;
};

/** What the caller knows about where a request came from; LAX Account forwards it, Identity records it. */
export type SubjectExportRequestContext = {
  sessionId: string;
  ipAddress: string | null;
  userAgent: string | null;
};

/** The audit vocabulary; each name is a row in the design's table of states and audit events. */
export const SUBJECT_EXPORT_AUDIT_EVENTS = [
  "data_export.requested",
  "data_export.product_collected",
  "data_export.delayed",
  "data_export.ready",
  "data_export.downloaded",
  "data_export.expired",
  "data_export.deleted_by_subject",
  "data_export.failed",
] as const;
export type SubjectExportAuditEvent = (typeof SUBJECT_EXPORT_AUDIT_EVENTS)[number];

/** Ids, counts, sizes, hashes, addresses and times. Never record content. */
export type SubjectExportAuditEntry = {
  event: SubjectExportAuditEvent;
  sessionId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  detail?: Record<string, string | number | boolean | null>;
};

/** A change to a request plus the audit rows that go with it, applied in one transaction. */
export type SubjectExportMutation = {
  patch: Partial<
    Pick<
      SubjectExportRow,
      | "status"
      | "productProgress"
      | "readyAt"
      | "expiresAt"
      | "deletedAt"
      | "objectKey"
      | "fileName"
      | "sizeBytes"
      | "sha256"
      | "downloadCount"
      | "lastErrorCode"
    >
  >;
  /** Set when the stored file must now be deleted (the copy was deleted by the person or expired). */
  queueObjectPurge?: boolean;
  audit: SubjectExportAuditEntry[];
};

export type CreateSubjectExportInput = {
  subjectId: string;
  requestedAt: Date;
  dueAt: Date;
  /** Start of the rolling window the request limit counts over. */
  windowStart: Date;
  maxPerWindow: number;
  windowDays: number;
  context: SubjectExportRequestContext;
};

export type CreateSubjectExportOutcome =
  | { outcome: "requested"; row: SubjectExportRow }
  | { outcome: "already_open"; row: SubjectExportRow }
  | { outcome: "rate_limited"; retryAfter: Date };

/** A stored copy Identity has asked to have deleted. */
export type SubjectExportPendingPurge = { exportId: string; objectKey: string };

export interface SubjectExportRepository {
  /**
   * Applies the one-open-request and per-window limits, inserts the request, writes the
   * `subject.data_export_requested` outbox event and the audit row, all in one transaction.
   */
  createIfAllowed(input: CreateSubjectExportInput): Promise<CreateSubjectExportOutcome>;
  /** The person's latest request, or null when there has never been one. */
  findLatest(subjectId: string): Promise<SubjectExportRow | null>;
  findById(exportId: string): Promise<SubjectExportRow | null>;
  /**
   * Locks the request, lets `decide` look at its current state and return a change (or null for
   * "nothing to do"), and applies the change with its audit rows. Returns the row after the
   * change, or null when nothing was changed or the request does not exist.
   */
  mutate(
    exportId: string,
    decide: (row: SubjectExportRow) => SubjectExportMutation | null,
  ): Promise<{ before: SubjectExportRow; after: SubjectExportRow } | null>;
  /** Stored copies whose deletion was requested and not yet confirmed, oldest request first. */
  listPendingObjectPurges(limit: number): Promise<SubjectExportPendingPurge[]>;
  /** Records that the stored copy is gone. False when there was nothing pending for the request. */
  markObjectPurged(exportId: string, at: Date): Promise<boolean>;
  /** Marks every ready copy past its expiry as expired and queues its file for deletion. */
  expireDue(now: Date, limit: number): Promise<SubjectExportRow[]>;
  /**
   * Requests that are still being prepared and have crossed a new overdue tier since the last
   * alert, each recorded as alerted so it is raised once per tier.
   */
  claimDeadlineAlerts(
    now: Date,
    tierFor: (row: SubjectExportRow, now: Date) => number,
    limit: number,
  ): Promise<{ row: SubjectExportRow; tier: number }[]>;
}

/** Signs one short-lived download for one stored file. The only storage access Identity has. */
export interface SubjectExportReadSigner {
  signDownload(input: {
    objectKey: string;
    fileName: string;
    expiresInSec: number;
    now: Date;
  }): Promise<{ url: string; expiresAt: Date }>;
}
