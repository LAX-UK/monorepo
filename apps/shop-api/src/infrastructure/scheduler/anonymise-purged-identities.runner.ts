import type { Database } from "@auction/db";
import { domainEvent, shopAdminAudit, shopProjectionCursor } from "@auction/db/schema";
import { userIdentityDeletedPayloadSchemaV1 } from "@auction/identity-contracts";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import {
  type ShopAnonymisationCounts,
  anonymiseShopPersonalData,
} from "../identity-purge/anonymise-shop-personal-data.js";
import {
  type ShopDomainEventPublisherMode,
  createShopDomainEventPublisher,
} from "../shop-domain-event-publisher.js";

export const PURGED_IDENTITY_ANONYMISATION_CURSOR = "shop_personal_data_anonymisation";
const BATCH = 50;

/** Who the audit entry names as the actor: the purge itself, not a person. */
export const IDENTITY_PURGE_ACTOR = "system:identity-purge";

/**
 * Records that Shop anonymised a person, in the staff audit and the domain event log. Both hold the
 * opaque subject id, the time and the rows changed per table, and no personal data.
 */
async function recordAudit(
  tx: Database,
  events: ReturnType<typeof createShopDomainEventPublisher>,
  subjectId: string,
  now: Date,
  tables: ShopAnonymisationCounts,
): Promise<void> {
  await tx.insert(shopAdminAudit).values({
    actorSubjectId: IDENTITY_PURGE_ACTOR,
    capability: "privacy.purge",
    action: "anonymise_purged_identity",
    targetType: "identity_subject",
    targetId: subjectId,
    afterJson: JSON.stringify({ tables }),
  });
  await events.insertInTransaction(tx, {
    aggregateType: "user",
    aggregateId: subjectId,
    eventType: "shop.user_anonymised",
    producer: "shop-api",
    payload: {
      schemaVersion: 1,
      subjectId,
      product: "shop",
      anonymisedAt: now.toISOString(),
      tables,
    },
  });
}

/**
 * Follows Identity's `user.identity_deleted`: when a person is purged, Shop anonymises what it
 * holds about them. The anonymisation, the audit and the cursor move commit together, so an event
 * is either fully applied once or retried whole.
 */
export function createAnonymisePurgedIdentitiesRunner(
  db: Database,
  options: { domainEventMode: ShopDomainEventPublisherMode },
): (now: Date) => Promise<{ processed: number }> {
  const events = createShopDomainEventPublisher(options.domainEventMode);
  return async (now) => {
    await db
      .insert(shopProjectionCursor)
      .values({ name: PURGED_IDENTITY_ANONYMISATION_CURSOR, lastEventId: 0 })
      .onConflictDoNothing();
    const [state] = await db
      .select({ cursor: shopProjectionCursor.lastEventId })
      .from(shopProjectionCursor)
      .where(eq(shopProjectionCursor.name, PURGED_IDENTITY_ANONYMISATION_CURSOR))
      .limit(1);
    const cursor = state?.cursor ?? 0;
    const rows = await db
      .select({ id: domainEvent.id, payload: domainEvent.payload })
      .from(domainEvent)
      .where(and(eq(domainEvent.eventType, "user.identity_deleted"), gt(domainEvent.id, cursor)))
      .orderBy(asc(domainEvent.id))
      .limit(BATCH);

    let processed = 0;
    for (const row of rows) {
      const { subjectId } = userIdentityDeletedPayloadSchemaV1.parse(row.payload);
      await db.transaction(async (rawTx) => {
        const tx = rawTx as Database;
        const tables = await anonymiseShopPersonalData(tx, subjectId, now);
        await recordAudit(tx, events, subjectId, now, tables);
        await tx
          .update(shopProjectionCursor)
          .set({ lastEventId: row.id, updatedAt: sql`now()` })
          .where(eq(shopProjectionCursor.name, PURGED_IDENTITY_ANONYMISATION_CURSOR));
      });
      processed += 1;
    }
    return { processed };
  };
}
