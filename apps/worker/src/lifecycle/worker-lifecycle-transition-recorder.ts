import type { Database } from "@auction/db";
import type { ILotLifecycleTransitionRecorder, RecordEndedInput } from "@auction/lot-lifecycle-app";
import type { Lot } from "@auction/types";
import { buildLotEndedJournalInput } from "./build-lot-ended-journal-input.js";
import type { WorkerLotLifecycleEventRecorder } from "./worker-lifecycle-event-recorder.js";

/** Maps lot-lifecycle-app transition hooks to journal + snapshot rows. */
export class WorkerLifecycleTransitionRecorder implements ILotLifecycleTransitionRecorder {
  constructor(private readonly recorder: WorkerLotLifecycleEventRecorder) {}

  recordActivated(
    tx: Database,
    lotRow: Pick<Lot, "id" | "saleId" | "sellerLegalEntityId" | "status">,
    activatedAt: Date,
  ) {
    return this.recorder.record(tx, {
      lotId: lotRow.id,
      eventType: "lot.activated",
      payload: { saleId: lotRow.saleId, activatedAt: activatedAt.toISOString() },
      actorUserId: null,
      actingLegalEntityId: lotRow.sellerLegalEntityId ?? null,
      snapshotPatch: {
        currentStatus: "active",
        lastEventType: "lot.activated",
        lastSaleId: lotRow.saleId,
      },
    });
  }

  recordEnded(tx: Database, input: RecordEndedInput) {
    return this.recorder.record(tx, buildLotEndedJournalInput(input));
  }

  recordVoided(
    tx: Database,
    lotRow: Pick<Lot, "id" | "saleId" | "sellerLegalEntityId" | "status">,
    reason: string,
  ) {
    return this.recorder.record(tx, {
      lotId: lotRow.id,
      eventType: "lot.voided",
      payload: { reason, lotId: lotRow.id },
      actorUserId: null,
      actingLegalEntityId: lotRow.sellerLegalEntityId ?? null,
      snapshotPatch: {
        currentStatus: "voided",
        lastEventType: "lot.voided",
        lastSaleOutcome: "no_sale",
      },
    });
  }
}
