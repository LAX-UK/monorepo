import type { Database } from "@auction/db";
import {
  domainEvent,
  shopArtworkInterest,
  shopBasket,
  shopBasketLine,
  shopClientAssignment,
  shopIdentityMergeInbox,
  shopOrder,
  shopParty,
  shopStaffMember,
} from "@auction/db/schema";
import { userIdentityMergedPayloadSchemaV1 } from "@auction/identity-contracts";
import { and, asc, eq, gt, inArray, isNull, notExists, sql } from "drizzle-orm";
import { createDrizzleShopNotificationPublisher } from "../drizzle-shop-notification.publisher.js";

const INGEST_BATCH = 100;
const PROCESS_BATCH = 5;
const MAX_ATTEMPTS = 8;
const INGEST_WINDOW_DAYS = 7;

type ShopStaffRole =
  | "shop_admin"
  | "account_manager"
  | "broker"
  | "operations"
  | "finance"
  | "catalogue_editor";

const STAFF_ROLE_RANK: Record<ShopStaffRole, number> = {
  shop_admin: 6,
  finance: 5,
  operations: 4,
  account_manager: 3,
  broker: 2,
  catalogue_editor: 1,
};

function higherStaffRole(a: ShopStaffRole, b: ShopStaffRole): ShopStaffRole {
  return STAFF_ROLE_RANK[a] >= STAFF_ROLE_RANK[b] ? a : b;
}

async function lockPartiesAsc(tx: Database, partyIds: string[]): Promise<void> {
  const sorted = [...partyIds].sort();
  for (const partyId of sorted) {
    await tx
      .select({ id: shopParty.id })
      .from(shopParty)
      .where(eq(shopParty.id, partyId))
      .for("update");
  }
}

async function mergeOpenBaskets(
  tx: Database,
  retiredSubjectId: string,
  canonicalSubjectId: string,
): Promise<void> {
  const [retiredBasket] = await tx
    .select({ id: shopBasket.id })
    .from(shopBasket)
    .where(and(eq(shopBasket.identitySubjectId, retiredSubjectId), isNull(shopBasket.retiredAt)))
    .limit(1);
  if (!retiredBasket) return;

  const [canonicalBasket] = await tx
    .select({ id: shopBasket.id })
    .from(shopBasket)
    .where(and(eq(shopBasket.identitySubjectId, canonicalSubjectId), isNull(shopBasket.retiredAt)))
    .limit(1);

  if (!canonicalBasket) {
    await tx
      .update(shopBasket)
      .set({ identitySubjectId: canonicalSubjectId, updatedAt: new Date() })
      .where(eq(shopBasket.id, retiredBasket.id));
    return;
  }

  await tx
    .select({ id: shopBasket.id })
    .from(shopBasket)
    .where(eq(shopBasket.id, canonicalBasket.id))
    .for("update");

  const fromLines = await tx
    .select()
    .from(shopBasketLine)
    .where(eq(shopBasketLine.basketId, retiredBasket.id));

  for (const line of fromLines) {
    if (line.artworkId) {
      await tx
        .insert(shopBasketLine)
        .values({
          basketId: canonicalBasket.id,
          artworkId: line.artworkId,
          productVariantId: null,
          unitPricePence: line.unitPricePence,
          quantity: line.quantity,
        })
        .onConflictDoUpdate({
          target: [shopBasketLine.basketId, shopBasketLine.artworkId],
          targetWhere: sql`${shopBasketLine.artworkId} IS NOT NULL`,
          set: {
            quantity: sql`${shopBasketLine.quantity} + ${line.quantity}`,
            updatedAt: new Date(),
          },
        });
      continue;
    }
    if (line.productVariantId) {
      await tx
        .insert(shopBasketLine)
        .values({
          basketId: canonicalBasket.id,
          artworkId: null,
          productVariantId: line.productVariantId,
          unitPricePence: line.unitPricePence,
          quantity: line.quantity,
        })
        .onConflictDoUpdate({
          target: [shopBasketLine.basketId, shopBasketLine.productVariantId],
          targetWhere: sql`${shopBasketLine.productVariantId} IS NOT NULL`,
          set: {
            quantity: sql`${shopBasketLine.quantity} + ${line.quantity}`,
            updatedAt: new Date(),
          },
        });
    }
  }

  await tx
    .update(shopBasket)
    .set({ retiredAt: new Date(), updatedAt: new Date() })
    .where(eq(shopBasket.id, retiredBasket.id));
}

async function applyIdentityMerge(
  tx: Database,
  payload: ReturnType<typeof userIdentityMergedPayloadSchemaV1.parse>,
): Promise<{ dead: true; reason: string } | { dead: false }> {
  const canonicalSubjectId = payload.subjectId;
  const retiredSubjectId = payload.retiredSubjectId;
  if (canonicalSubjectId === retiredSubjectId) {
    throw new Error("identity_merge_subjects_must_differ");
  }

  const [retiredParty] = await tx
    .select({ id: shopParty.id })
    .from(shopParty)
    .where(eq(shopParty.identitySubjectId, retiredSubjectId))
    .limit(1);
  const [canonicalParty] = await tx
    .select({ id: shopParty.id })
    .from(shopParty)
    .where(eq(shopParty.identitySubjectId, canonicalSubjectId))
    .limit(1);

  if (retiredParty && canonicalParty) {
    return {
      dead: true,
      reason: "both_subjects_have_shop_party",
    };
  }

  const partyIds = [retiredParty?.id, canonicalParty?.id].filter(
    (id): id is string => id !== undefined,
  );
  if (partyIds.length > 0) {
    await lockPartiesAsc(tx, partyIds);
  }

  if (retiredParty && !canonicalParty) {
    await tx
      .update(shopParty)
      .set({ identitySubjectId: canonicalSubjectId })
      .where(eq(shopParty.id, retiredParty.id));
  }

  const [retiredStaff] = await tx
    .select()
    .from(shopStaffMember)
    .where(eq(shopStaffMember.identitySubjectId, retiredSubjectId))
    .limit(1);
  const [canonicalStaff] = await tx
    .select()
    .from(shopStaffMember)
    .where(eq(shopStaffMember.identitySubjectId, canonicalSubjectId))
    .limit(1);

  if (retiredStaff && canonicalStaff) {
    const role = higherStaffRole(
      retiredStaff.role as ShopStaffRole,
      canonicalStaff.role as ShopStaffRole,
    );
    await tx
      .update(shopStaffMember)
      .set({ role, disabledAt: retiredStaff.disabledAt ?? canonicalStaff.disabledAt })
      .where(eq(shopStaffMember.id, canonicalStaff.id));
    await tx.delete(shopStaffMember).where(eq(shopStaffMember.id, retiredStaff.id));
  } else if (retiredStaff) {
    await tx
      .update(shopStaffMember)
      .set({ identitySubjectId: canonicalSubjectId })
      .where(eq(shopStaffMember.id, retiredStaff.id));
  }

  await tx
    .update(shopOrder)
    .set({ identitySubjectId: canonicalSubjectId, updatedAt: new Date() })
    .where(eq(shopOrder.identitySubjectId, retiredSubjectId));

  await mergeOpenBaskets(tx, retiredSubjectId, canonicalSubjectId);

  await tx.execute(sql`
    DELETE FROM shop_artwork_interest AS retired
    USING shop_artwork_interest AS canonical
    WHERE retired.identity_subject_id = ${retiredSubjectId}
      AND canonical.identity_subject_id = ${canonicalSubjectId}
      AND retired.artwork_id = canonical.artwork_id
      AND retired.intent = canonical.intent
  `);
  await tx
    .update(shopArtworkInterest)
    .set({ identitySubjectId: canonicalSubjectId })
    .where(eq(shopArtworkInterest.identitySubjectId, retiredSubjectId));

  await tx
    .update(shopClientAssignment)
    .set({ brokerSubjectId: canonicalSubjectId })
    .where(eq(shopClientAssignment.brokerSubjectId, retiredSubjectId));

  return { dead: false };
}

async function ingestIdentityMergeEvents(db: Database): Promise<number> {
  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(shopIdentityMergeInbox);
  const inboxEmpty = (countRow?.count ?? 0) === 0;
  const windowStart = inboxEmpty
    ? new Date(0)
    : new Date(Date.now() - INGEST_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const events = await db
    .select({
      id: domainEvent.id,
      payload: domainEvent.payload,
    })
    .from(domainEvent)
    .where(
      and(
        eq(domainEvent.eventType, "user.identity_merged"),
        gt(domainEvent.occurredAt, windowStart),
        notExists(
          db
            .select({ eventId: shopIdentityMergeInbox.eventId })
            .from(shopIdentityMergeInbox)
            .where(eq(shopIdentityMergeInbox.eventId, domainEvent.id)),
        ),
      ),
    )
    .orderBy(asc(domainEvent.id))
    .limit(INGEST_BATCH);

  let ingested = 0;
  for (const event of events) {
    const inserted = await db
      .insert(shopIdentityMergeInbox)
      .values({
        eventId: event.id,
        payload: event.payload,
        status: "pending",
      })
      .onConflictDoNothing()
      .returning({ eventId: shopIdentityMergeInbox.eventId });
    ingested += inserted.length;
  }
  return ingested;
}

async function recordMergeFailure(
  db: Database,
  eventId: number,
  attempts: number,
  message: string,
  opsAlertEmail: string | null,
  notifications: ReturnType<typeof createDrizzleShopNotificationPublisher>,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        status: shopIdentityMergeInbox.status,
        attempts: shopIdentityMergeInbox.attempts,
      })
      .from(shopIdentityMergeInbox)
      .where(eq(shopIdentityMergeInbox.eventId, eventId))
      .for("update")
      .limit(1);
    if (!row || row.status === "completed" || row.status === "dead") {
      return;
    }
    const nextAttempts = attempts;
    const terminal = nextAttempts >= MAX_ATTEMPTS;
    await tx
      .update(shopIdentityMergeInbox)
      .set({
        status: terminal ? "dead" : "failed",
        attempts: nextAttempts,
        lastError: message,
        processedAt: terminal ? new Date() : null,
      })
      .where(eq(shopIdentityMergeInbox.eventId, eventId));

    if (terminal && opsAlertEmail) {
      await notifications.queueCheckoutOpsAlert(tx as Database, {
        idempotencyKey: `identity-merge-failed:${eventId}`,
        opsEmail: opsAlertEmail,
        alertKind: "identity_merge_failed",
        orderId: eventId.toString(),
        detail: message,
      });
    }
  });
}

export function createProcessIdentityMergeInboxRunner(
  db: Database,
  opsAlertEmail: string | null,
): () => Promise<{ ingested: number; processed: number }> {
  const notifications = createDrizzleShopNotificationPublisher();

  return async () => {
    const ingested = await ingestIdentityMergeEvents(db);
    let processed = 0;

    for (let i = 0; i < PROCESS_BATCH; i++) {
      try {
        const didProcess = await db.transaction(async (tx) => {
          const [row] = await tx
            .select()
            .from(shopIdentityMergeInbox)
            .where(inArray(shopIdentityMergeInbox.status, ["pending", "failed"]))
            .orderBy(asc(shopIdentityMergeInbox.eventId))
            .limit(1)
            .for("update", { skipLocked: true });
          if (!row) {
            return false;
          }

          const attempts = row.attempts + 1;
          const payload = userIdentityMergedPayloadSchemaV1.parse(row.payload);
          const outcome = await applyIdentityMerge(tx as Database, payload);

          if (outcome.dead) {
            await tx
              .update(shopIdentityMergeInbox)
              .set({
                status: "dead",
                attempts,
                lastError: outcome.reason,
                processedAt: new Date(),
              })
              .where(eq(shopIdentityMergeInbox.eventId, row.eventId));

            if (opsAlertEmail) {
              await notifications.queueCheckoutOpsAlert(tx as Database, {
                idempotencyKey: `identity-merge-dead:${row.eventId}`,
                opsEmail: opsAlertEmail,
                alertKind: "identity_merge_dead",
                orderId: row.eventId.toString(),
                detail: `${outcome.reason} retired=${payload.retiredSubjectId} canonical=${payload.subjectId}`,
              });
            }
          } else {
            await tx
              .update(shopIdentityMergeInbox)
              .set({
                status: "completed",
                attempts,
                lastError: null,
                processedAt: new Date(),
              })
              .where(eq(shopIdentityMergeInbox.eventId, row.eventId));
          }
          return true;
        });
        if (!didProcess) {
          break;
        }
        processed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const [failedRow] = await db
          .select({
            eventId: shopIdentityMergeInbox.eventId,
            attempts: shopIdentityMergeInbox.attempts,
          })
          .from(shopIdentityMergeInbox)
          .where(inArray(shopIdentityMergeInbox.status, ["pending", "failed"]))
          .orderBy(asc(shopIdentityMergeInbox.eventId))
          .limit(1);
        if (failedRow) {
          await recordMergeFailure(
            db,
            failedRow.eventId,
            failedRow.attempts + 1,
            message,
            opsAlertEmail,
            notifications,
          );
        }
      }
    }

    return { ingested, processed };
  };
}
