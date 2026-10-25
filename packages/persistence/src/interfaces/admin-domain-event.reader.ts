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
    includePii: boolean;
  }): Promise<RedactedDomainEventRow[]>;
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
