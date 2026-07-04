import type { IAdminDomainEventReader } from "@auction/persistence/interfaces";
import type {
  IAdminDomainEventQueryService,
  RedactedDomainEventRow,
} from "../interfaces/admin-routes.js";

export class AdminDomainEventQueryService implements IAdminDomainEventQueryService {
  constructor(private readonly reader: IAdminDomainEventReader) {}

  listRedacted(input: {
    limit: number;
    offset?: number;
    eventTypePrefix?: string;
    aggregateType?: string;
    aggregateId?: string;
    includePii: boolean;
  }): Promise<RedactedDomainEventRow[]> {
    return this.reader.listRedacted(input);
  }

  countForExport(input: { aggregateType?: string; aggregateId?: string }): Promise<number> {
    return this.reader.countForExport(input);
  }
}
