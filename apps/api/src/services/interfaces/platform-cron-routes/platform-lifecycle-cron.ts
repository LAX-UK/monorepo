import type { LifecycleCronService } from "@auction/finance-cron-app";

export type LotLifecycleTickCronResult =
  | { ok: true; data: Awaited<ReturnType<LifecycleCronService["runLotLifecycleTick"]>> }
  | { ok: false; status: 409 | 503; body: { reason: string } };

export interface IPlatformLifecycleCronApplicationService {
  runLotLifecycleTickWithLock(): Promise<LotLifecycleTickCronResult>;
  processNotificationOutbox(): ReturnType<LifecycleCronService["processNotificationOutbox"]>;
}
