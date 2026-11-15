import type {
  AuditActorRecord,
  AuditLogSearchInput,
  AuditLogSearchResult,
  RedactedDomainEventRow,
} from "./admin-read-models.js";

export interface IAdminDomainEventReader {
  listRedacted(input: {
    limit: number;
    offset?: number;
    eventTypePrefix?: string;
    aggregateType?: string;
    aggregateId?: string;
    /** Only these event types; applied in the query, before the limit. */
    eventTypes?: readonly string[];
    /** With an aggregate: newest first instead of oldest first, so the limit cuts the old end. */
    newestFirst?: boolean;
    includePii: boolean;
  }): Promise<RedactedDomainEventRow[]>;
  /** Display names from the identity directory, keyed by user id; unknown ids are left out. */
  actorNames(userIds: readonly string[]): Promise<Map<string, string>>;
  countForExport(input: { aggregateType?: string; aggregateId?: string }): Promise<number>;
  /** Filtered audit events, newest first unless `sort` is `at_asc`, each with its actor, plus the total for paging. */
  searchAuditLog(input: AuditLogSearchInput): Promise<AuditLogSearchResult>;
  /** People who appear as an actor in the audit log, found by name or email. */
  searchAuditActors(input: {
    q?: string;
    limit: number;
    staffOnly: boolean;
  }): Promise<AuditActorRecord[]>;
}

export type { RedactedDomainEventRow };
