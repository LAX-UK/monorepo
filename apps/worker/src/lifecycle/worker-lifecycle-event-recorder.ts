import type { Database } from "@auction/db";
import type {
  ILotLifecycleSnapshotRepository,
  LotLifecycleSnapshotPatch,
} from "@auction/persistence/interfaces";
import type { IWorkerDomainEventSink } from "../interfaces/worker-domain-event-sink.js";

export type RecordLotLifecycleInput = {
  lotId: string;
  eventType: string;
  payload: Record<string, unknown>;
  actorUserId?: string | null;
  actingLegalEntityId?: string | null;
  snapshotPatch: LotLifecycleSnapshotPatch;
  seedSnapshot?: boolean;
};

/** Tx-bound domain event + lot_lifecycle_snapshot upsert (worker producer). */
export class WorkerLotLifecycleEventRecorder {
  constructor(
    private readonly inner: IWorkerDomainEventSink,
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
      producer: "apps/worker",
    });

    await this.snapshotRepository.forConnection(tx).upsertSnapshot({
      lotId: input.lotId,
      actorUserId: input.actorUserId ?? null,
      snapshotPatch: input.snapshotPatch,
      ...(input.seedSnapshot !== undefined ? { seedSnapshot: input.seedSnapshot } : {}),
    });
  }
}
