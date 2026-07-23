import type { Database } from "@auction/db";
import type {
  ILifecycleDomainEventSink,
  ILotLifecycleTransitionRecorder,
  RecordEndedInput,
} from "@auction/lot-lifecycle-app";
import type { IDomainEventSink } from "../domain-event-sink.js";
import type { ILotLifecycleRecorder } from "../interfaces/lot-lifecycle-recorder.js";
import type { RecordEndedInput as ApiRecordEndedInput } from "../lot-lifecycle-recording.types.js";

export function toLifecycleDomainEventSink(
  sink: IDomainEventSink | null | undefined,
): ILifecycleDomainEventSink | null {
  if (!sink) return null;
  return {
    publish: (event) => sink.publish(event),
    withTx: (tx: Database) => {
      const bound = toLifecycleDomainEventSink(sink.withTx(tx));
      if (!bound) {
        throw new Error("domain_event_sink_unavailable_in_transaction");
      }
      return bound;
    },
  };
}

export function toLotLifecycleTransitionRecorder(
  recorder: ILotLifecycleRecorder | null | undefined,
): ILotLifecycleTransitionRecorder | null {
  if (!recorder) return null;
  return {
    recordActivated: (tx, lotRow, activatedAt) => recorder.recordActivated(tx, lotRow, activatedAt),
    recordEnded: (tx: Database, input: RecordEndedInput) =>
      recorder.recordEnded(tx, input as ApiRecordEndedInput),
    recordVoided: (tx, lotRow, reason) => recorder.recordVoided(tx, lotRow, reason),
  };
}
