import type { RecordEndedInput } from "@auction/lot-lifecycle-app";
import type { RecordLotLifecycleInput } from "./worker-lifecycle-event-recorder.js";

/** Shared `lot.ended` domain event + snapshot patch for worker journal writers. */
export function buildLotEndedJournalInput(input: RecordEndedInput): RecordLotLifecycleInput {
  const endedAt = input.payload.endedAt ?? new Date().toISOString();
  return {
    lotId: input.lot.id,
    eventType: "lot.ended",
    payload: {
      ...input.payload,
      hadWinner: input.payload.outcome === "sold",
      endedAt,
    },
    actorUserId: input.actorUserId ?? null,
    actingLegalEntityId: input.lot.sellerLegalEntityId ?? null,
    snapshotPatch: {
      currentStatus: "ended",
      lastEventType: "lot.ended",
      lastSaleOutcome: input.payload.outcome,
      lastSaleEndedAt: new Date(endedAt),
    },
  };
}
