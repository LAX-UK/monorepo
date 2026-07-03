import type { RedactedDomainEventRow } from "./admin-read-models.js";

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
}

export type { RedactedDomainEventRow };
