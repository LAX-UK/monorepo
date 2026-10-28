import type { Database } from "@auction/db";
import { domainEvent, shopStaffAccessInbox } from "@auction/db/schema";
import {
  isLaxAdminRole,
  laxStaffAccessGrantedPayloadSchemaV1,
  laxStaffAccessRevokedPayloadSchemaV1,
} from "@auction/types";
import { and, asc, eq, gt, inArray, notExists, sql } from "drizzle-orm";
import { ShopStaffRoleRefused } from "../../application/admin/shop-staff-roster.service.js";
import { createDrizzleShopNotificationPublisher } from "../drizzle-shop-notification.publisher.js";
import { shopStaffRosterOn } from "../grant-staff-role.js";

const STAFF_ACCESS_EVENT_TYPES = ["lax.staff_access.granted", "lax.staff_access.revoked"] as const;
const INGEST_BATCH = 100;
const PROCESS_BATCH = 10;
const MAX_ATTEMPTS = 8;
const INGEST_WINDOW_DAYS = 7;

type Outcome = { dead: false } | { dead: true; reason: string };

/**
 * Applies one Bid-emitted staff access event to LAX Admin's roster: a grant adds the role, a
 * revocation ends one role (or every role), and a revocation naming an assignment records that
 * its end date passed. Bid checks the role rules before it asks; the roster checks them again,
 * and a refusal (a forbidden pair, the last Administrator) can never succeed on retry, so it is
 * dead-lettered for a human instead.
 */
async function applyStaffAccessEvent(
  tx: Database,
  eventId: number,
  eventType: (typeof STAFF_ACCESS_EVENT_TYPES)[number],
  payload: unknown,
): Promise<Outcome> {
  const roster = shopStaffRosterOn(tx);
  try {
    if (eventType === "lax.staff_access.granted") {
      const parsed = laxStaffAccessGrantedPayloadSchemaV1.safeParse(payload);
      if (!parsed.success) return { dead: true, reason: "invalid_payload" };
      const role = parsed.data.role;
      if (!isLaxAdminRole(role)) return { dead: true, reason: `unknown_shop_role:${role}` };
      await roster.assign({
        subjectId: parsed.data.subjectId,
        role,
        endsAt: parsed.data.endsAt ? new Date(parsed.data.endsAt) : null,
        actorSubjectId: parsed.data.grantedBySubjectId,
        reason: parsed.data.reason ?? null,
        eventId,
      });
      return { dead: false };
    }

    const parsed = laxStaffAccessRevokedPayloadSchemaV1.safeParse(payload);
    if (!parsed.success) return { dead: true, reason: "invalid_payload" };
    const attribution = {
      subjectId: parsed.data.subjectId,
      actorSubjectId: parsed.data.revokedBySubjectId,
      reason: parsed.data.reason ?? null,
      eventId,
    };
    if (parsed.data.assignmentId) {
      await roster.recordExpiry({ ...attribution, assignmentId: parsed.data.assignmentId });
      return { dead: false };
    }
    const role = parsed.data.role ?? null;
    if (role !== null && !isLaxAdminRole(role)) {
      return { dead: true, reason: `unknown_shop_role:${role}` };
    }
    await roster.remove({ ...attribution, role });
    return { dead: false };
  } catch (error) {
    if (error instanceof ShopStaffRoleRefused) return { dead: true, reason: error.message };
    throw error;
  }
}

async function ingestStaffAccessEvents(db: Database): Promise<number> {
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(shopStaffAccessInbox);
  const windowStart =
    (countRow?.count ?? 0) === 0
      ? new Date(0)
      : new Date(Date.now() - INGEST_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const events = await db
    .select({ id: domainEvent.id, eventType: domainEvent.eventType, payload: domainEvent.payload })
    .from(domainEvent)
    .where(
      and(
        inArray(domainEvent.eventType, [...STAFF_ACCESS_EVENT_TYPES]),
        sql`${domainEvent.payload}->>'product' = 'shop'`,
        gt(domainEvent.occurredAt, windowStart),
        notExists(
          db
            .select({ eventId: shopStaffAccessInbox.eventId })
            .from(shopStaffAccessInbox)
            .where(eq(shopStaffAccessInbox.eventId, domainEvent.id)),
        ),
      ),
    )
    .orderBy(asc(domainEvent.id))
    .limit(INGEST_BATCH);

  if (events.length === 0) return 0;
  const inserted = await db
    .insert(shopStaffAccessInbox)
    .values(
      events.map((e) => ({
        eventId: e.id,
        eventType: e.eventType as (typeof STAFF_ACCESS_EVENT_TYPES)[number],
        payload: e.payload,
      })),
    )
    .onConflictDoNothing()
    .returning({ eventId: shopStaffAccessInbox.eventId });
  return inserted.length;
}

export function createProcessStaffAccessInboxRunner(
  db: Database,
  opsAlertEmail: string | null,
): () => Promise<{ ingested: number; processed: number }> {
  const notifications = createDrizzleShopNotificationPublisher();

  async function deadLetter(tx: Database, eventId: number, attempts: number, reason: string) {
    await tx
      .update(shopStaffAccessInbox)
      .set({ status: "dead", attempts, lastError: reason, processedAt: new Date() })
      .where(eq(shopStaffAccessInbox.eventId, eventId));
    if (opsAlertEmail) {
      await notifications.queueCheckoutOpsAlert(tx, {
        idempotencyKey: `staff-access-dead:${eventId}`,
        opsEmail: opsAlertEmail,
        alertKind: "staff_access_dead",
        orderId: eventId.toString(),
        detail: reason,
      });
    }
  }

  async function recordFailure(eventId: number, message: string): Promise<void> {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ status: shopStaffAccessInbox.status, attempts: shopStaffAccessInbox.attempts })
        .from(shopStaffAccessInbox)
        .where(eq(shopStaffAccessInbox.eventId, eventId))
        .for("update")
        .limit(1);
      if (!row || row.status === "completed" || row.status === "dead") return;
      const attempts = row.attempts + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await deadLetter(tx as Database, eventId, attempts, message);
        return;
      }
      await tx
        .update(shopStaffAccessInbox)
        .set({ status: "failed", attempts, lastError: message })
        .where(eq(shopStaffAccessInbox.eventId, eventId));
    });
  }

  return async () => {
    const ingested = await ingestStaffAccessEvents(db);
    let processed = 0;

    for (let i = 0; i < PROCESS_BATCH; i++) {
      let claimed: number | null = null;
      try {
        const didProcess = await db.transaction(async (tx) => {
          const [row] = await tx
            .select()
            .from(shopStaffAccessInbox)
            .where(
              and(
                inArray(shopStaffAccessInbox.status, ["pending", "failed"]),
                sql`${shopStaffAccessInbox.attempts} < ${MAX_ATTEMPTS}`,
              ),
            )
            .orderBy(asc(shopStaffAccessInbox.eventId))
            .limit(1)
            .for("update", { skipLocked: true });
          if (!row) return false;
          claimed = row.eventId;

          const attempts = row.attempts + 1;
          const outcome = await applyStaffAccessEvent(
            tx as Database,
            row.eventId,
            row.eventType,
            row.payload,
          );
          if (outcome.dead) {
            await deadLetter(tx as Database, row.eventId, attempts, outcome.reason);
          } else {
            await tx
              .update(shopStaffAccessInbox)
              .set({ status: "completed", attempts, lastError: null, processedAt: new Date() })
              .where(eq(shopStaffAccessInbox.eventId, row.eventId));
          }
          return true;
        });
        if (!didProcess) break;
        processed += 1;
      } catch (error) {
        if (claimed === null) throw error;
        await recordFailure(claimed, error instanceof Error ? error.message : String(error));
      }
    }

    return { ingested, processed };
  };
}
