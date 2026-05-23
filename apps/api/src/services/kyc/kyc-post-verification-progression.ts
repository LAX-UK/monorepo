import type { Database } from "@auction/db";
import { legalEntity } from "@auction/db/schema";
import { and, eq } from "drizzle-orm";
import type { DomainEventPublisher } from "../domain-event.publisher.js";

/** After KYC approval, advance sole-trader individuals stuck in `lead`. Idempotent. */
export async function progressIndividualsAfterKycApproval(
  db: Database,
  publisher: DomainEventPublisher | undefined,
  userId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const bumped = await tx
      .update(legalEntity)
      .set({
        status: "connect_pending",
        statusChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(legalEntity.createdByUserId, userId),
          eq(legalEntity.kind, "individual"),
          eq(legalEntity.status, "lead"),
        ),
      )
      .returning({ id: legalEntity.id });

    if (!publisher || bumped.length === 0) {
      return;
    }

    await publisher.publish(tx, {
      aggregateType: "user",
      aggregateId: userId,
      eventType: "kyc.verified",
      payload: {
        legalEntityIdsAdvancedToConnectPending: bumped.map((b) => b.id),
      },
      actorUserId: null,
      actingLegalEntityId: null,
    });

    for (const row of bumped) {
      await publisher.publish(tx, {
        aggregateType: "legal_entity",
        aggregateId: row.id,
        eventType: "legal_entity.lifecycle_progressed",
        payload: {
          from_status: "lead",
          to_status: "connect_pending",
          reason: "kyc_approved",
        },
        actorUserId: null,
        actingLegalEntityId: row.id,
      });
    }
  });
}

/** @deprecated Use {@link progressIndividualsAfterKycApproval}. */
export const progressIndividualsAfterIdentityVerification = progressIndividualsAfterKycApproval;
