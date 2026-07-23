import type { ILotEarlyCloseLifecycleRecorder, RecordEndedInput } from "@auction/bidding-runtime";
import type { Database } from "@auction/db";
import type { RecordEndedInput as LifecycleRecordEndedInput } from "@auction/lot-lifecycle-app";
import { buildLotEndedJournalInput } from "../lifecycle/build-lot-ended-journal-input.js";
import type { WorkerLotLifecycleEventRecorder } from "../lifecycle/worker-lifecycle-event-recorder.js";

function toLifecycleRecordEndedInput(input: RecordEndedInput): LifecycleRecordEndedInput {
  const p = input.payload;
  return {
    lot: input.lot,
    ...(input.actorUserId !== undefined ? { actorUserId: input.actorUserId } : {}),
    payload: {
      outcome: p.outcome,
      winnerId: p.winnerId,
      saleId: p.saleId,
      trigger: p.trigger,
      ...(p.hammerPrice !== undefined ? { hammerPrice: p.hammerPrice } : {}),
      ...(p.endedAt !== undefined ? { endedAt: p.endedAt } : {}),
    },
  };
}

/** Records bid-triggered early-close `lot.ended` events on worker replay paths. */
export class WorkerBidLotLifecycleRecording implements ILotEarlyCloseLifecycleRecorder {
  constructor(private readonly recorder: WorkerLotLifecycleEventRecorder) {}

  recordEnded(tx: Database, input: RecordEndedInput): Promise<void> {
    return this.recorder.record(tx, buildLotEndedJournalInput(toLifecycleRecordEndedInput(input)));
  }
}
