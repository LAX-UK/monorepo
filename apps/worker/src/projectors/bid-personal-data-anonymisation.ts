import { domainEvent } from "@auction/db/schema";
import { userIdentityDeletedPayloadSchemaV1 } from "@auction/identity-contracts";
import { userPersonalDataAnonymisedPayloadSchemaV1 } from "@auction/types";
import { and, eq } from "drizzle-orm";
import {
  type AnonymisationCounts,
  anonymiseBidPersonalData,
} from "../anonymisation/anonymise-bid-personal-data.js";
import type { DomainEventProjectorRow } from "../interfaces/domain-event-projector.reader.js";
import type { ProjectorDbConnection } from "../interfaces/worker-db.types.js";
import type { ProjectorRunContext } from "./lib/projector.types.js";

export const BID_PERSONAL_DATA_ANONYMISATION_PROJECTOR = "bid_personal_data_anonymisation";

const AUDIT_EVENT_TYPE = "bid.user_anonymised";

/**
 * Records that Bid anonymised a person: who (the opaque subject id), when, and the rows changed per
 * table. At most one record exists per person, so a replayed event adds nothing. It holds no
 * personal data.
 */
async function recordAudit(
  tx: ProjectorDbConnection,
  subjectId: string,
  anonymisedAt: Date,
  tables: AnonymisationCounts,
): Promise<void> {
  const [existing] = await tx
    .select({ id: domainEvent.id })
    .from(domainEvent)
    .where(
      and(
        eq(domainEvent.eventType, AUDIT_EVENT_TYPE),
        eq(domainEvent.aggregateType, "user"),
        eq(domainEvent.aggregateId, subjectId),
      ),
    )
    .limit(1);
  if (existing) return;
  const payload = userPersonalDataAnonymisedPayloadSchemaV1.parse({
    schemaVersion: 1,
    subjectId,
    product: "bid",
    anonymisedAt: anonymisedAt.toISOString(),
    tables,
  });
  await tx.insert(domainEvent).values({
    aggregateType: "user",
    aggregateId: subjectId,
    eventType: AUDIT_EVENT_TYPE,
    payload,
    schemaVersion: 1,
    producer: "apps/worker",
  });
}

export async function applyBidPersonalDataAnonymisation(
  tx: ProjectorDbConnection,
  row: DomainEventProjectorRow,
  now: Date = new Date(),
): Promise<void> {
  const payload = userIdentityDeletedPayloadSchemaV1.parse(row.payload);
  const tables = await anonymiseBidPersonalData(tx, payload.subjectId);
  await recordAudit(tx, payload.subjectId, now, tables);
}

/** Follows Identity's `user.identity_deleted` and anonymises what Bid holds about that person. */
export async function processBidPersonalDataAnonymisation(ctx: ProjectorRunContext): Promise<void> {
  const { domainEventReader, projectorStateRepo } = ctx;
  await projectorStateRepo.ensureCursor(BID_PERSONAL_DATA_ANONYMISATION_PROJECTOR);
  const cursor = await projectorStateRepo.getCursor(BID_PERSONAL_DATA_ANONYMISATION_PROJECTOR);
  const rows = await domainEventReader.listAfterCursor(cursor, {
    eventTypes: ["user.identity_deleted"],
    limit: 50,
  });
  if (rows.length === 0) return;

  let maxId = cursor;
  for (const row of rows) {
    try {
      await ctx.transactionRunner.runInTransaction((tx) =>
        applyBidPersonalDataAnonymisation(tx, row),
      );
      maxId = row.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // The event id is enough to find the person; the log never carries their data.
      ctx.log.error({ err, eventId: row.id }, "bid_personal_data_anonymisation_failed");
      await projectorStateRepo.recordError(BID_PERSONAL_DATA_ANONYMISATION_PROJECTOR, message);
      return;
    }
  }

  if (maxId > cursor) {
    await projectorStateRepo.advanceCursor(BID_PERSONAL_DATA_ANONYMISATION_PROJECTOR, maxId);
  }
}
