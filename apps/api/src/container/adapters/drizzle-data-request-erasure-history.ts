import type { Database } from "@auction/db";
import { bidIdentityDirectory, domainEvent } from "@auction/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import type {
  DataRequestErasureEntry,
  IDataRequestErasureHistory,
} from "../../services/admin/data-requests/data-request-erasure-history.js";

/**
 * Reads the `marketing_enquiry.erased` audit events that name the request. They are written in
 * the erasure's own transaction, so a row exists only for an erasure that happened. The payload
 * holds counts and the reference; the actor's name comes from the identity directory.
 */
export class DrizzleDataRequestErasureHistory implements IDataRequestErasureHistory {
  constructor(private readonly db: Database) {}

  async forReference(reference: string): Promise<DataRequestErasureEntry[]> {
    const rows = await this.db
      .select({
        at: domainEvent.occurredAt,
        payload: domainEvent.payload,
        actorName: bidIdentityDirectory.name,
      })
      .from(domainEvent)
      .leftJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, domainEvent.actorUserId))
      .where(
        and(
          eq(domainEvent.eventType, "marketing_enquiry.erased"),
          sql`${domainEvent.payload}->>'requestReference' = ${reference}`,
        ),
      )
      .orderBy(asc(domainEvent.occurredAt), asc(domainEvent.id));
    return rows.map((row) => {
      const enquiries = (row.payload as { enquiries?: unknown } | null)?.enquiries;
      return {
        at: row.at,
        actorName: row.actorName ?? null,
        enquiries: typeof enquiries === "number" ? enquiries : 0,
      };
    });
  }
}
