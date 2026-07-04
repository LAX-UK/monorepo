import type { ProjectorDbConnection } from "./worker-db.types.js";

export type DomainEventProjectorRow = {
  id: number;
  eventType: string;
  aggregateId: string;
  payload: unknown;
  actorUserId?: string | null;
};

export type ListDomainEventsAfterCursorOptions = {
  eventTypes?: readonly string[];
  limit?: number;
};

export interface IDomainEventProjectorReader {
  listAfterCursor(
    cursor: number,
    options?: ListDomainEventsAfterCursorOptions,
  ): Promise<DomainEventProjectorRow[]>;

  /** `FOR UPDATE SKIP LOCKED` poll used by zoho / marketing-contacts projectors. */
  listLockedForProjector(
    projectorName: string,
    limit: number,
    conn: ProjectorDbConnection,
  ): Promise<DomainEventProjectorRow[]>;
}
