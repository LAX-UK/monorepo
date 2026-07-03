import type { Database } from "@auction/db";
import { DrizzleTransactionRunner, type ITransactionRunner } from "@auction/persistence";
import { AuthAuditPublisher } from "../services/auth-audit.publisher.js";
import { DomainEventSink, type IDomainEventSink } from "../services/domain-event-sink.js";
import { DomainEventPublisher } from "../services/domain-event.publisher.js";
import type { ILotLifecycleRecorder } from "../services/interfaces/lot-lifecycle-recorder.js";
import { LotLifecycleEventRecorder } from "../services/lot-lifecycle-event-recorder.js";
import { LotLifecycleRecording } from "../services/lot-lifecycle-recording.service.js";
import { NotificationFactory } from "../services/notification.factory.js";
import { LotStrategyFactory } from "../strategies/strategy.factory.js";

import type { ContainerRepositories } from "./create-repositories.js";

export type ContainerPlatformCore = {
  domainEventPublisher: DomainEventPublisher;
  domainEventSink: IDomainEventSink;
  transactionRunner: ITransactionRunner;
  lotLifecycleEventRecorder: LotLifecycleEventRecorder;
  lotLifecycleRecording: ILotLifecycleRecorder;
  authAuditPublisher: AuthAuditPublisher;
  strategyFactory: LotStrategyFactory;
  notificationFactory: NotificationFactory;
};

export function createPlatformCore(
  db: Database,
  repos: Pick<ContainerRepositories, "lotLifecycleSnapshotRepository">,
): ContainerPlatformCore {
  const domainEventPublisher = new DomainEventPublisher();
  const domainEventSink: IDomainEventSink = new DomainEventSink(domainEventPublisher, db);
  const transactionRunner: ITransactionRunner = new DrizzleTransactionRunner(db);
  const lotLifecycleEventRecorder = new LotLifecycleEventRecorder(
    domainEventPublisher,
    repos.lotLifecycleSnapshotRepository,
  );
  const lotLifecycleRecording: ILotLifecycleRecorder = new LotLifecycleRecording(
    lotLifecycleEventRecorder,
  );
  const authAuditPublisher = new AuthAuditPublisher(domainEventPublisher, db);
  const strategyFactory = new LotStrategyFactory();
  const notificationFactory = new NotificationFactory();

  return {
    domainEventPublisher,
    domainEventSink,
    transactionRunner,
    lotLifecycleEventRecorder,
    lotLifecycleRecording,
    authAuditPublisher,
    strategyFactory,
    notificationFactory,
  };
}
