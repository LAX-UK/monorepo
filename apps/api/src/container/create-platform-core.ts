import type { Database } from "@auction/db";
import type { ITransactionRunner } from "@auction/persistence/interfaces";
import { DrizzleTransactionRunner } from "@auction/persistence/repositories";
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
  env: Pick<import("../env.js").Env, "DOMAIN_EVENT_PUBLISH_VALIDATE">,
): ContainerPlatformCore {
  const domainEventPublisher = new DomainEventPublisher({
    publishValidateMode: env.DOMAIN_EVENT_PUBLISH_VALIDATE,
  });
  const domainEventSink: IDomainEventSink = new DomainEventSink(domainEventPublisher, db);
  const transactionRunner: ITransactionRunner = new DrizzleTransactionRunner(db);
  const lotLifecycleEventRecorder = new LotLifecycleEventRecorder(
    domainEventSink,
    repos.lotLifecycleSnapshotRepository,
  );
  const lotLifecycleRecording: ILotLifecycleRecorder = new LotLifecycleRecording(
    lotLifecycleEventRecorder,
  );
  const authAuditPublisher = new AuthAuditPublisher(domainEventSink);
  const strategyFactory = new LotStrategyFactory();
  const notificationFactory = new NotificationFactory();

  return {
    domainEventSink,
    transactionRunner,
    lotLifecycleEventRecorder,
    lotLifecycleRecording,
    authAuditPublisher,
    strategyFactory,
    notificationFactory,
  };
}
