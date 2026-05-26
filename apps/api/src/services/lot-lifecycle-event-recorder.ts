import type { Database } from "@auction/db";
import { lotLifecycleSnapshot } from "@auction/db/schema";
import type { LotStatus } from "@auction/types";
import { eq, sql } from "drizzle-orm";
import type { LotEventType } from "../domain/lot-events.js";
import type { DomainEventPublisher } from "./domain-event.publisher.js";

export type LotLifecycleSnapshotPatch = {
  currentStatus?: LotStatus;
  lastEventType: LotEventType | string;
  lastEventAt?: Date;
  lastActorUserId?: string | null;
  lastSaleId?: string | null;
  lastSaleOutcome?: string | null;
  lastSaleEndedAt?: Date | null;
  returnedToInventoryAt?: Date | null;
  returnCountDelta?: number;
  attachedCountDelta?: number;
};

export type RecordLotLifecycleInput = {
  lotId: string;
  eventType: LotEventType | string;
  payload: Record<string, unknown>;
  actorUserId?: string | null;
  actingLegalEntityId?: string | null;
  snapshotPatch: LotLifecycleSnapshotPatch;
  seedSnapshot?: boolean;
};

/** Tx-bound facade: append domain event + upsert lot_lifecycle_snapshot in one transaction. */
export class LotLifecycleEventRecorder {
  constructor(private readonly inner: DomainEventPublisher) {}

  async record(tx: Database, input: RecordLotLifecycleInput): Promise<void> {
    const now = input.snapshotPatch.lastEventAt ?? new Date();

    await this.inner.publish(tx, {
      aggregateType: "lot",
      aggregateId: input.lotId,
      eventType: input.eventType,
      payload: input.payload,
      actorUserId: input.actorUserId ?? null,
      actingLegalEntityId: input.actingLegalEntityId ?? null,
      schemaVersion: 1,
      producer: "apps/api",
    });

    if (input.seedSnapshot) {
      await tx.insert(lotLifecycleSnapshot).values({
        lotId: input.lotId,
        currentStatus: input.snapshotPatch.currentStatus ?? "draft",
        lastEventType: input.snapshotPatch.lastEventType,
        lastEventAt: now,
        lastActorUserId: input.snapshotPatch.lastActorUserId ?? input.actorUserId ?? null,
        lastSaleId: input.snapshotPatch.lastSaleId ?? null,
        lastSaleOutcome: input.snapshotPatch.lastSaleOutcome ?? null,
        lastSaleEndedAt: input.snapshotPatch.lastSaleEndedAt ?? null,
        returnedToInventoryAt: input.snapshotPatch.returnedToInventoryAt ?? null,
        returnCount: Math.max(0, input.snapshotPatch.returnCountDelta ?? 0),
        attachedCount: Math.max(0, input.snapshotPatch.attachedCountDelta ?? 0),
        updatedAt: now,
      });
      return;
    }

    const patch = input.snapshotPatch;
    await tx
      .insert(lotLifecycleSnapshot)
      .values({
        lotId: input.lotId,
        currentStatus: patch.currentStatus ?? "draft",
        lastEventType: patch.lastEventType,
        lastEventAt: now,
        lastActorUserId: patch.lastActorUserId ?? input.actorUserId ?? null,
        lastSaleId: patch.lastSaleId ?? null,
        lastSaleOutcome: patch.lastSaleOutcome ?? null,
        lastSaleEndedAt: patch.lastSaleEndedAt ?? null,
        returnedToInventoryAt: patch.returnedToInventoryAt ?? null,
        returnCount: Math.max(0, patch.returnCountDelta ?? 0),
        attachedCount: Math.max(0, patch.attachedCountDelta ?? 0),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: lotLifecycleSnapshot.lotId,
        set: {
          ...(patch.currentStatus !== undefined ? { currentStatus: patch.currentStatus } : {}),
          lastEventType: patch.lastEventType,
          lastEventAt: now,
          lastActorUserId: patch.lastActorUserId ?? input.actorUserId ?? null,
          ...(patch.lastSaleId !== undefined ? { lastSaleId: patch.lastSaleId } : {}),
          ...(patch.lastSaleOutcome !== undefined
            ? { lastSaleOutcome: patch.lastSaleOutcome }
            : {}),
          ...(patch.lastSaleEndedAt !== undefined
            ? { lastSaleEndedAt: patch.lastSaleEndedAt }
            : {}),
          ...(patch.returnedToInventoryAt !== undefined
            ? { returnedToInventoryAt: patch.returnedToInventoryAt }
            : {}),
          returnCount: sql`${lotLifecycleSnapshot.returnCount} + ${patch.returnCountDelta ?? 0}`,
          attachedCount: sql`${lotLifecycleSnapshot.attachedCount} + ${patch.attachedCountDelta ?? 0}`,
          updatedAt: now,
        },
      });
  }
}

export async function getLotLifecycleSnapshot(db: Database, lotId: string) {
  const [row] = await db
    .select()
    .from(lotLifecycleSnapshot)
    .where(eq(lotLifecycleSnapshot.lotId, lotId))
    .limit(1);
  return row ?? null;
}
