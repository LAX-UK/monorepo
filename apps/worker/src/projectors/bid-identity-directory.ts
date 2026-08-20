import { bidIdentityDirectory } from "@auction/db/schema";
import {
  userDeletionCancelledPayloadSchemaV1,
  userDeletionRequestedPayloadSchemaV1,
  userIdentityDeletedPayloadSchemaV1,
  userIdentityMergedPayloadSchemaV1,
  userProfileUpdatedPayloadSchemaV1,
} from "@auction/identity-contracts";
import { userEmailVerifiedPayloadSchemaV1, userRegisteredPayloadSchemaV1 } from "@auction/types";
import { and, eq, or, sql } from "drizzle-orm";
import type { DomainEventProjectorRow } from "../interfaces/domain-event-projector.reader.js";
import type { ProjectorDbConnection } from "../interfaces/worker-db.types.js";
import type { ProjectorRunContext } from "./lib/projector.types.js";

export const BID_IDENTITY_DIRECTORY_PROJECTOR = "bid_identity_directory";

export const BID_IDENTITY_DIRECTORY_EVENT_TYPES = [
  "user.registered",
  "user.profile_updated",
  "user.email_verified",
  "user.deletion_requested",
  "user.deletion_cancelled",
  "user.identity_merged",
  "user.identity_deleted",
] as const;

type DirectoryValues = typeof bidIdentityDirectory.$inferInsert;

function newerThan(eventId: number) {
  return sql`${bidIdentityDirectory.lastEventId} is null or ${bidIdentityDirectory.lastEventId} < ${eventId}`;
}

async function insertRegistered(
  tx: ProjectorDbConnection,
  row: DomainEventProjectorRow,
  replicatedAt: Date,
): Promise<void> {
  const payload = userRegisteredPayloadSchemaV1.parse(row.payload);
  const identityCreatedAt = payload.createdAt
    ? new Date(payload.createdAt)
    : (row.occurredAt ?? replicatedAt);
  await tx
    .insert(bidIdentityDirectory)
    .values({
      subjectId: payload.userId,
      email: payload.email,
      name: payload.name,
      ...(payload.image !== undefined ? { image: payload.image } : {}),
      ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
      emailVerified: payload.emailVerified ?? false,
      identityCreatedAt,
      replicatedAt,
      lastEventId: row.id,
    })
    .onConflictDoUpdate({
      target: bidIdentityDirectory.subjectId,
      set: {
        replicatedAt,
        lastEventId: row.id,
      },
      setWhere: newerThan(row.id),
    });
}

async function updateSubject(
  tx: ProjectorDbConnection,
  subjectId: string,
  eventId: number,
  replicatedAt: Date,
  values: Partial<DirectoryValues>,
): Promise<void> {
  await tx
    .update(bidIdentityDirectory)
    .set({
      ...values,
      replicatedAt,
      lastEventId: eventId,
    })
    .where(
      and(
        or(
          eq(bidIdentityDirectory.subjectId, subjectId),
          eq(bidIdentityDirectory.mergedIntoSubjectId, subjectId),
        ),
        newerThan(eventId),
      ),
    );
}

async function mergeIdentity(
  tx: ProjectorDbConnection,
  row: DomainEventProjectorRow,
  replicatedAt: Date,
): Promise<void> {
  const payload = userIdentityMergedPayloadSchemaV1.parse(row.payload);
  if (payload.subjectId === payload.retiredSubjectId) {
    throw new Error("identity_merge_subjects_must_differ");
  }

  const [retired] = await tx
    .select()
    .from(bidIdentityDirectory)
    .where(and(eq(bidIdentityDirectory.subjectId, payload.retiredSubjectId), newerThan(row.id)))
    .limit(1);

  if (retired) {
    await tx
      .insert(bidIdentityDirectory)
      .values({
        subjectId: payload.subjectId,
        email: retired.email,
        name: retired.name,
        image: retired.image,
        phone: retired.phone,
        emailVerified: retired.emailVerified,
        deletionRequestedAt: retired.deletionRequestedAt,
        identityCreatedAt: retired.identityCreatedAt,
        replicatedAt,
        lastEventId: row.id,
      })
      .onConflictDoUpdate({
        target: bidIdentityDirectory.subjectId,
        set: {
          replicatedAt,
          lastEventId: row.id,
        },
        setWhere: newerThan(row.id),
      });
  } else {
    await updateSubject(tx, payload.subjectId, row.id, replicatedAt, {});
  }

  if (retired) {
    await tx.execute(sql`
      UPDATE ${bidIdentityDirectory} AS retired
      SET
        email = canonical.email,
        name = canonical.name,
        image = canonical.image,
        phone = canonical.phone,
        email_verified = canonical.email_verified,
        deletion_requested_at = canonical.deletion_requested_at,
        merged_into_subject_id = ${payload.subjectId},
        replicated_at = ${replicatedAt},
        last_event_id = ${row.id}
      FROM ${bidIdentityDirectory} AS canonical
      WHERE retired.subject_id = ${payload.retiredSubjectId}
        AND canonical.subject_id = ${payload.subjectId}
        AND retired.last_event_id < ${row.id}
    `);
  }
}

export async function applyBidIdentityDirectoryEvent(
  tx: ProjectorDbConnection,
  row: DomainEventProjectorRow,
  replicatedAt = new Date(),
): Promise<void> {
  switch (row.eventType) {
    case "user.registered":
      await insertRegistered(tx, row, replicatedAt);
      return;
    case "user.profile_updated": {
      const payload = userProfileUpdatedPayloadSchemaV1.parse(row.payload);
      await updateSubject(tx, payload.subjectId, row.id, replicatedAt, {
        ...(payload.email !== undefined ? { email: payload.email } : {}),
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.image !== undefined ? { image: payload.image } : {}),
        ...(payload.phone !== undefined ? { phone: payload.phone } : {}),
      });
      return;
    }
    case "user.email_verified": {
      const payload = userEmailVerifiedPayloadSchemaV1.parse(row.payload);
      await updateSubject(tx, payload.userId, row.id, replicatedAt, {
        email: payload.email,
        emailVerified: true,
      });
      return;
    }
    case "user.deletion_requested": {
      const parsed = userDeletionRequestedPayloadSchemaV1.safeParse(row.payload);
      if (parsed.success) {
        await updateSubject(tx, parsed.data.subjectId, row.id, replicatedAt, {
          deletionRequestedAt: new Date(parsed.data.requestedAt),
        });
        return;
      }

      // Before Identity owned this event, apps/api emitted `{ userId }` without a
      // timestamp. Migration 0156 backfills the state; replay only advances this
      // row's ordering marker so an old event cannot overwrite that backfill.
      const legacy = row.payload as { userId?: unknown };
      if (!legacy || typeof legacy !== "object" || typeof legacy.userId !== "string") {
        throw parsed.error;
      }
      await updateSubject(tx, legacy.userId, row.id, replicatedAt, {});
      return;
    }
    case "user.deletion_cancelled": {
      const payload = userDeletionCancelledPayloadSchemaV1.parse(row.payload);
      await updateSubject(tx, payload.subjectId, row.id, replicatedAt, {
        deletionRequestedAt: null,
      });
      return;
    }
    case "user.identity_merged":
      await mergeIdentity(tx, row, replicatedAt);
      return;
    case "user.identity_deleted": {
      const payload = userIdentityDeletedPayloadSchemaV1.parse(row.payload);
      await tx
        .delete(bidIdentityDirectory)
        .where(
          and(
            or(
              eq(bidIdentityDirectory.subjectId, payload.subjectId),
              eq(bidIdentityDirectory.mergedIntoSubjectId, payload.subjectId),
            ),
            newerThan(row.id),
          ),
        );
      return;
    }
  }
}

export async function processBidIdentityDirectory(ctx: ProjectorRunContext): Promise<void> {
  const { domainEventReader, projectorStateRepo } = ctx;
  await projectorStateRepo.ensureCursor(BID_IDENTITY_DIRECTORY_PROJECTOR);
  const cursor = await projectorStateRepo.getCursor(BID_IDENTITY_DIRECTORY_PROJECTOR);
  const rows = await domainEventReader.listAfterCursor(cursor, {
    eventTypes: [...BID_IDENTITY_DIRECTORY_EVENT_TYPES],
    limit: 50,
  });
  if (rows.length === 0) return;

  let maxId = cursor;
  for (const row of rows) {
    try {
      await ctx.transactionRunner.runInTransaction((tx) => applyBidIdentityDirectoryEvent(tx, row));
      maxId = row.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.log.error({ err, eventId: row.id }, "bid_identity_directory_projection_failed");
      await projectorStateRepo.recordError(BID_IDENTITY_DIRECTORY_PROJECTOR, message);
      return;
    }
  }

  if (maxId > cursor) {
    await projectorStateRepo.advanceCursor(BID_IDENTITY_DIRECTORY_PROJECTOR, maxId);
  }
}
