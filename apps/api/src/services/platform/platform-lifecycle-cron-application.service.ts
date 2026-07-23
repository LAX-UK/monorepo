import { runWithRenewableLease } from "@auction/background-runtime";
import type { LifecycleCronService } from "@auction/finance-cron-app";
import type { Redis } from "ioredis";
import type {
  IPlatformLifecycleCronApplicationService,
  LotLifecycleTickCronResult,
} from "../interfaces/platform-cron-routes/platform-lifecycle-cron.js";

export const LOT_LIFECYCLE_TICK_LOCK_KEY = "lot:lifecycle:tick:lock";
const LOT_LIFECYCLE_TICK_LOCK_TTL_MS = 15_000;

/** Catalog/platform lifecycle cron ingress (lot tick + notification outbox). */
export class PlatformLifecycleCronApplicationService
  implements IPlatformLifecycleCronApplicationService
{
  constructor(
    private readonly redis: Redis,
    private readonly lifecycleCronService: LifecycleCronService,
  ) {}

  async runLotLifecycleTickWithLock(): Promise<LotLifecycleTickCronResult> {
    const locked = await runWithRenewableLease(
      this.redis,
      LOT_LIFECYCLE_TICK_LOCK_KEY,
      LOT_LIFECYCLE_TICK_LOCK_TTL_MS,
      () => this.lifecycleCronService.runLotLifecycleTick(),
    );
    if (!locked.ok) {
      if (locked.reason === "lock_failed") {
        return { ok: false, status: 503, body: { reason: "lifecycle_tick_lock_failed" } };
      }
      return { ok: false, status: 409, body: { reason: "lifecycle_tick_already_running" } };
    }
    return { ok: true, data: locked.value };
  }

  processNotificationOutbox() {
    return this.lifecycleCronService.processNotificationOutbox();
  }
}
