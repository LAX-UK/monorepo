import { randomUUID } from "node:crypto";
import type { IdentityDatabase } from "@auction/identity-db";
import {
  oauthApplication,
  oidcBackchannelLogoutDelivery,
  oidcRpSession,
} from "@auction/identity-db/schema";
import { and, eq, inArray, isNull, lte, or } from "drizzle-orm";
import type {
  BackchannelLogoutDeliveryRepository,
  BackchannelLogoutFinalization,
  RpLogoutRepository,
} from "../services/backchannel-logout.ports.js";

type RevocationRow = {
  clientId: string;
  subjectId: string;
  sid: string;
  endpoint: string | null;
};

export function backchannelDeliveryEventKey(clientId: string, sid: string): string {
  return `${clientId}:${sid}`;
}

export class DrizzleRpLogoutRepository implements RpLogoutRepository {
  constructor(private readonly db: IdentityDatabase) {}

  revokeIdentitySessionsAndEnqueue(ids: readonly string[], now: Date): Promise<number> {
    const condition = and(
      inArray(oidcRpSession.identitySessionId, [...ids]),
      isNull(oidcRpSession.revokedAt),
    );
    if (!condition) throw new Error("Identity session revocation condition is empty");
    return this.revokeAndEnqueue(condition, now);
  }

  revokeSubjectAndEnqueue(subjectId: string, now: Date): Promise<number> {
    const condition = and(eq(oidcRpSession.subjectId, subjectId), isNull(oidcRpSession.revokedAt));
    if (!condition) throw new Error("Subject revocation condition is empty");
    return this.revokeAndEnqueue(condition, now);
  }

  revokeClientSubjectAndEnqueue(clientId: string, subjectId: string, now: Date): Promise<number> {
    const condition = and(
      eq(oidcRpSession.clientId, clientId),
      eq(oidcRpSession.subjectId, subjectId),
      isNull(oidcRpSession.revokedAt),
    );
    if (!condition) throw new Error("Client subject revocation condition is empty");
    return this.revokeAndEnqueue(condition, now);
  }

  private async revokeAndEnqueue(
    condition: NonNullable<ReturnType<typeof and>>,
    now: Date,
  ): Promise<number> {
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select({
          clientId: oidcRpSession.clientId,
          subjectId: oidcRpSession.subjectId,
          sid: oidcRpSession.sid,
          endpoint: oauthApplication.backchannelLogoutUri,
        })
        .from(oidcRpSession)
        .innerJoin(oauthApplication, eq(oauthApplication.clientId, oidcRpSession.clientId))
        .where(condition);
      if (rows.length === 0) return 0;
      await tx
        .update(oidcRpSession)
        .set({ revokedAt: now, updatedAt: now })
        .where(
          or(
            ...rows.map((row) =>
              and(eq(oidcRpSession.clientId, row.clientId), eq(oidcRpSession.sid, row.sid)),
            ),
          ),
        );
      const deliverable = rows.filter(
        (row): row is RevocationRow & { endpoint: string } => row.endpoint !== null,
      );
      if (deliverable.length > 0) {
        await tx
          .insert(oidcBackchannelLogoutDelivery)
          .values(
            deliverable.map((row) => ({
              id: randomUUID(),
              eventKey: backchannelDeliveryEventKey(row.clientId, row.sid),
              clientId: row.clientId,
              subjectId: row.subjectId,
              sid: row.sid,
              endpoint: row.endpoint,
              tokenJti: randomUUID(),
              tokenIat: Math.floor(now.getTime() / 1_000),
              status: "pending" as const,
              attemptCount: 0,
              nextAttemptAt: now,
              createdAt: now,
              updatedAt: now,
            })),
          )
          .onConflictDoNothing({ target: oidcBackchannelLogoutDelivery.eventKey });
      }
      return rows.length;
    });
  }
}

export class DrizzleBackchannelLogoutDeliveryRepository
  implements BackchannelLogoutDeliveryRepository
{
  constructor(private readonly db: IdentityDatabase) {}

  async claimDue(input: { now: Date; staleBefore: Date; batchSize: number }) {
    await this.db
      .update(oidcBackchannelLogoutDelivery)
      .set({ status: "pending", claimedAt: null, updatedAt: input.now })
      .where(
        and(
          eq(oidcBackchannelLogoutDelivery.status, "delivering"),
          lte(oidcBackchannelLogoutDelivery.claimedAt, input.staleBefore),
        ),
      );
    return this.db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: oidcBackchannelLogoutDelivery.id,
          clientId: oidcBackchannelLogoutDelivery.clientId,
          subjectId: oidcBackchannelLogoutDelivery.subjectId,
          sid: oidcBackchannelLogoutDelivery.sid,
          endpoint: oidcBackchannelLogoutDelivery.endpoint,
          tokenJti: oidcBackchannelLogoutDelivery.tokenJti,
          tokenIat: oidcBackchannelLogoutDelivery.tokenIat,
          attemptCount: oidcBackchannelLogoutDelivery.attemptCount,
        })
        .from(oidcBackchannelLogoutDelivery)
        .where(
          and(
            eq(oidcBackchannelLogoutDelivery.status, "pending"),
            lte(oidcBackchannelLogoutDelivery.nextAttemptAt, input.now),
          ),
        )
        .limit(input.batchSize)
        .for("update", { skipLocked: true });
      if (rows.length > 0) {
        await tx
          .update(oidcBackchannelLogoutDelivery)
          .set({ status: "delivering", claimedAt: input.now, updatedAt: input.now })
          .where(
            inArray(
              oidcBackchannelLogoutDelivery.id,
              rows.map((row) => row.id),
            ),
          );
      }
      return rows;
    });
  }

  async finalize(input: BackchannelLogoutFinalization): Promise<void> {
    await this.db
      .update(oidcBackchannelLogoutDelivery)
      .set({
        status: input.status,
        attemptCount: input.attemptCount,
        claimedAt: null,
        deliveredAt: input.deliveredAt,
        lastStatusCode: input.statusCode,
        lastError: input.errorMessage,
        nextAttemptAt: input.nextAttemptAt,
        updatedAt: input.finalizedAt,
      })
      .where(eq(oidcBackchannelLogoutDelivery.id, input.id));
  }
}
