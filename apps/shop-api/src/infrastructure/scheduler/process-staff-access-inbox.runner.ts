import type { Database } from "@auction/db";
import { domainEvent, shopStaffAccessInbox } from "@auction/db/schema";
import { SHOP_API_ERROR_CODES } from "@auction/shop-contracts";
import type { ShopStaffRole } from "@auction/shop-domain";
import {
  laxShopStaffRoles,
  laxStaffAccessGrantedPayloadSchemaV1,
  laxStaffAccessRevokedPayloadSchemaV1,
} from "@auction/types";
import { and, asc, eq, gt, inArray, notExists, sql } from "drizzle-orm";
import { ShopApiError } from "../../errors/shop-api-error.js";
import { createDrizzleShopNotificationPublisher } from "../drizzle-shop-notification.publisher.js";
import { grantShopStaffRoleInTx, revokeShopStaffRoleInTx } from "../grant-staff-role.js";

const STAFF_ACCESS_EVENT_TYPES = ["lax.staff_access.granted", "lax.staff_access.revoked"] as const;
const INGEST_BATCH = 100;
const PROCESS_BATCH = 10;
const MAX_ATTEMPTS = 8;
const INGEST_WINDOW_DAYS = 7;

type Outcome = { dead: false } | { dead: true; reason: string };

function isShopRole(role: string): role is ShopStaffRole {
  return (laxShopStaffRoles as readonly string[]).includes(role);
}

function isRosterConflict(error: unknown): error is ShopApiError {
  return error instanceof ShopApiError && error.code === SHOP_API_ERROR_CODES.CONFLICT;
}

/**
 * Applies one Bid-emitted staff access event. Roster conflicts (removing the last Shop
 * admin) can never succeed on retry, so they are dead-lettered for a human instead.
 */
async function applyStaffAccessEvent(
  tx: Database,
  eventType: (typeof STAFF_ACCESS_EVENT_TYPES)[number],
  payload: unknown,
): Promise<Outcome> {
  if (eventType === "lax.staff_access.granted") {
    const parsed = laxStaffAccessGrantedPayloadSchemaV1.safeParse(payload);
    if (!parsed.success) return { dead: true, reason: "invalid_payload" };
    if (!isShopRole(parsed.data.role)) {
      return { dead: true, reason: `unknown_shop_role:${parsed.data.role}` };
    }
    const role = parsed.data.role;
    try {
      await tx.transaction(async (sp) =>
        grantShopStaffRoleInTx(sp as Database, {
          subject: parsed.data.subjectId,
          role,
          operatorSubjectId: parsed.data.grantedBySubjectId,
        }),
      );
    } catch (error) {
      if (isRosterConflict(error)) return { dead: true, reason: error.message };
      throw error;
    }
    return { dead: false };
  }

  const parsed = laxStaffAccessRevokedPayloadSchemaV1.safeParse(payload);
  if (!parsed.success) return { dead: true, reason: "invalid_payload" };
  try {
    await tx.transaction(async (sp) =>
      revokeShopStaffRoleInTx(sp as Database, {
        subject: parsed.data.subjectId,
        operatorSubjectId: parsed.data.revokedBySubjectId,
      }),
    );
  } catch (error) {
    if (isRosterConflict(error)) return { dead: true, reason: error.message };
    throw error;
  }
  return { dead: false };
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
          const outcome = await applyStaffAccessEvent(tx as Database, row.eventType, row.payload);
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
