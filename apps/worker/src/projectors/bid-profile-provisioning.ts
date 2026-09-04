import {
  userIdentityDisabledPayloadSchemaV1,
  userIdentityEnabledPayloadSchemaV1,
  userIdentityMergedPayloadSchemaV1,
  userProfileUpdatedPayloadSchemaV1,
} from "@auction/identity-contracts";
import {
  provisionBidUserProfileShell,
  writeBidUserProfile,
} from "@auction/persistence/bid-user-profile-sync";
import { userRegisteredPayloadSchemaV1 } from "@auction/types";
import type pino from "pino";
import type { ProjectorRunContext } from "./lib/projector.types.js";

export const BID_PROFILE_PROVISIONING_PROJECTOR = "bid_profile_provisioning";

export async function processBidProfileProvisioning(options: {
  ctx: ProjectorRunContext;
  log: pino.Logger;
}): Promise<void> {
  const { ctx, log } = options;
  const { projectorStateRepo, domainEventReader } = ctx;

  await projectorStateRepo.ensureCursor(BID_PROFILE_PROVISIONING_PROJECTOR);
  const cursor = await projectorStateRepo.getCursor(BID_PROFILE_PROVISIONING_PROJECTOR);

  const rows = await domainEventReader.listAfterCursor(cursor, {
    eventTypes: [
      "user.registered",
      "user.profile_updated",
      "user.identity_disabled",
      "user.identity_enabled",
      "user.identity_merged",
    ],
    limit: 50,
  });
  if (rows.length === 0) return;

  let maxId = cursor;
  for (const row of rows) {
    try {
      await ctx.transactionRunner.runInTransaction(async (tx) => {
        if (row.eventType === "user.registered") {
          const payload = userRegisteredPayloadSchemaV1.strict().parse(row.payload);
          const registeredAt = payload.createdAt
            ? new Date(payload.createdAt)
            : (row.occurredAt ?? new Date());
          await provisionBidUserProfileShell(tx, payload.userId, registeredAt);
          return;
        }
        if (row.eventType === "user.profile_updated") {
          const payload = userProfileUpdatedPayloadSchemaV1.parse(row.payload);
          if (payload.email !== undefined) {
            await writeBidUserProfile(tx, payload.subjectId, {
              emailStatus: "ok",
              emailStatusChangedAt: new Date(payload.updatedAt),
            });
          }
          return;
        }
        if (row.eventType === "user.identity_disabled") {
          const payload = userIdentityDisabledPayloadSchemaV1.parse(row.payload);
          await writeBidUserProfile(tx, payload.subjectId, {
            identityDisabledAt: new Date(payload.disabledAt),
          });
          return;
        }
        if (row.eventType === "user.identity_enabled") {
          const payload = userIdentityEnabledPayloadSchemaV1.parse(row.payload);
          await writeBidUserProfile(tx, payload.subjectId, { identityDisabledAt: null });
          return;
        }
        if (row.eventType === "user.identity_merged") {
          const payload = userIdentityMergedPayloadSchemaV1.parse(row.payload);
          await writeBidUserProfile(tx, payload.retiredSubjectId, {
            identityDisabledAt: new Date(payload.mergedAt),
            mergedIntoSubjectId: payload.subjectId,
          });
        }
      });
      maxId = row.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error({ err, eventId: row.id }, "bid_profile_provisioning_failed");
      await projectorStateRepo.recordError(BID_PROFILE_PROVISIONING_PROJECTOR, message);
      return;
    }
  }

  if (maxId > cursor) {
    await projectorStateRepo.advanceCursor(BID_PROFILE_PROVISIONING_PROJECTOR, maxId);
  }
}
