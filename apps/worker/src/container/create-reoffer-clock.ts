import type { Database } from "@auction/db";
import type { ITransactionRunner } from "@auction/persistence/interfaces";
import {
  DrizzleLotLifecycleSnapshotRepository,
  DrizzleLotReofferRepository,
  DrizzleNotificationOutboxRepository,
  DrizzleReofferInvoiceMarker,
  DrizzleReofferSweepReader,
  DrizzleReofferWorkflowReader,
  DrizzleSellerConsentRepository,
} from "@auction/persistence/repositories";
import type { ICollectionNoticeReader } from "../interfaces/collection-notice.reader.js";
import type { IWorkerDomainEventSink } from "../interfaces/worker-domain-event-sink.js";
import { WorkerLotLifecycleEventRecorder } from "../lifecycle/worker-lifecycle-event-recorder.js";
import { JournalReofferClockEvents } from "../reoffer/reoffer-clock-events.js";
import { ReofferClockService } from "../reoffer/reoffer-clock.service.js";
import { OutboxReofferNotices } from "../reoffer/reoffer-outbox-notices.js";

/** The re-offer clock and what it reads, on the worker's database connection. */
export function createReofferClock(input: {
  db: Database;
  transactionRunner: ITransactionRunner;
  domainEventSink: IWorkerDomainEventSink;
  people: Pick<ICollectionNoticeReader, "accountRecipients">;
  now?: () => Date;
}) {
  const { db } = input;
  const reader = new DrizzleReofferSweepReader(db);
  const clock = new ReofferClockService({
    transactionRunner: input.transactionRunner,
    workflow: new DrizzleReofferWorkflowReader(),
    offers: new DrizzleLotReofferRepository(),
    consents: new DrizzleSellerConsentRepository(db),
    defaults: reader,
    events: new JournalReofferClockEvents(
      new WorkerLotLifecycleEventRecorder(
        input.domainEventSink,
        new DrizzleLotLifecycleSnapshotRepository(db),
      ),
    ),
    notices: new OutboxReofferNotices(new DrizzleNotificationOutboxRepository(db), input.people),
    ...(input.now ? { now: input.now } : {}),
  });
  return { clock, reader, marker: new DrizzleReofferInvoiceMarker(db) };
}
