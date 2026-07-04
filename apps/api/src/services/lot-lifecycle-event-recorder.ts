import type { Database } from "@auction/db";
import type { ILotLifecycleSnapshotRepository, LotLifecycleSnapshotPatch } from "@auction/persistence/interfaces";
import type { LotEventType } from "../domain/lot-events.js";
import type { IDomainEventSink } from "./domain-event-sink.js";

export type { LotLifecycleSnapshotPatch } from "@auction/persistence/interfaces";

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
  constructor(
    private readonly inner: IDomainEventSink,
    private readonly snapshotRepository: ILotLifecycleSnapshotRepository,
  ) {}

  async record(tx: Database, input: RecordLotLifecycleInput): Promise<void> {
    await this.inner.withTx(tx).publish({
      aggregateType: "lot",
      aggregateId: input.lotId,
      eventType: input.eventType,
      payload: input.payload,
      actorUserId: input.actorUserId ?? null,
      actingLegalEntityId: input.actingLegalEntityId ?? null,
      schemaVersion: 1,
      producer: "apps/api",
    });

    await this.snapshotRepository.forConnection(tx).upsertSnapshot({
      lotId: input.lotId,
      actorUserId: input.actorUserId ?? null,
      snapshotPatch: input.snapshotPatch,
      ...(input.seedSnapshot !== undefined ? { seedSnapshot: input.seedSnapshot } : {}),
    });
  }
}
