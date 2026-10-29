import type { Database } from "@auction/db";
import {
  domainEvent,
  shopArtist,
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
import { normalizeLaxAdminRoles, primaryLaxAdminRole } from "@auction/types";
import { and, asc, eq, gt, inArray, isNull, notExists, sql } from "drizzle-orm";
import { createDrizzleShopNotificationPublisher } from "../drizzle-shop-notification.publisher.js";
import { activeShopStaffRolesSql } from "../shop-staff-active-roles.sql.js";

const INGEST_BATCH = 100;
const PROCESS_BATCH = 5;
const MAX_ATTEMPTS = 8;
const INGEST_WINDOW_DAYS = 7;

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
    // The canonical person keeps their roles and gains the retired one's that they lack; the
    // retired record and any role both held go with it (the assignments cascade).
    await tx.execute(sql`
      UPDATE shop_staff_role_assignment AS retired
      SET identity_subject_id = ${canonicalSubjectId}
      WHERE retired.identity_subject_id = ${retiredSubjectId}
        AND (
          retired.ends_at IS NOT NULL
          OR NOT EXISTS (
            SELECT 1 FROM shop_staff_role_assignment AS canonical
            WHERE canonical.identity_subject_id = ${canonicalSubjectId}
              AND canonical.role = retired.role
              AND canonical.ends_at IS NULL
          )
        )
    `);
    await tx.delete(shopStaffMember).where(eq(shopStaffMember.id, retiredStaff.id));
    const [held] = await tx
      .select({ roles: activeShopStaffRolesSql(shopStaffMember.identitySubjectId) })
      .from(shopStaffMember)
      .where(eq(shopStaffMember.id, canonicalStaff.id));
    const primary = primaryLaxAdminRole(normalizeLaxAdminRoles(held?.roles ?? []));
    await tx
      .update(shopStaffMember)
      .set(primary ? { role: primary, disabledAt: null } : { disabledAt: new Date() })
      .where(eq(shopStaffMember.id, canonicalStaff.id));
  } else if (retiredStaff) {
    // Its role assignments follow through the foreign key.
    await tx
      .update(shopStaffMember)
      .set({ identitySubjectId: canonicalSubjectId })
      .where(eq(shopStaffMember.id, retiredStaff.id));
  }

  const [retiredArtist] = await tx
    .select({ id: shopArtist.id })
    .from(shopArtist)
    .where(eq(shopArtist.identitySubjectId, retiredSubjectId))
    .limit(1);
  const [canonicalArtist] = await tx
    .select({ id: shopArtist.id })
    .from(shopArtist)
    .where(eq(shopArtist.identitySubjectId, canonicalSubjectId))
    .limit(1);
  if (retiredArtist && canonicalArtist) {
    await tx
      .update(shopArtist)
      .set({ identitySubjectId: null })
      .where(eq(shopArtist.id, retiredArtist.id));
  } else if (retiredArtist) {
    await tx
      .update(shopArtist)
      .set({ identitySubjectId: canonicalSubjectId })
      .where(eq(shopArtist.id, retiredArtist.id));
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

  await tx.execute(sql`
    DELETE FROM shop_saved_artwork AS retired
    USING shop_saved_artwork AS canonical
    WHERE retired.identity_subject_id = ${retiredSubjectId}
      AND canonical.identity_subject_id = ${canonicalSubjectId}
      AND retired.artwork_id = canonical.artwork_id
  `);
  await tx.execute(sql`
    UPDATE shop_saved_artwork
    SET identity_subject_id = ${canonicalSubjectId}
    WHERE identity_subject_id = ${retiredSubjectId}
  `);

  await tx.execute(sql`
    DELETE FROM shop_followed_artist AS retired
    USING shop_followed_artist AS canonical
    WHERE retired.identity_subject_id = ${retiredSubjectId}
      AND canonical.identity_subject_id = ${canonicalSubjectId}
      AND retired.artist_id = canonical.artist_id
  `);
  await tx.execute(sql`
    UPDATE shop_followed_artist
    SET identity_subject_id = ${canonicalSubjectId}
    WHERE identity_subject_id = ${retiredSubjectId}
  `);

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
