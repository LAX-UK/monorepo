import type { Database } from "@auction/db";
import type { FastifyBaseLogger } from "fastify";
import { releaseShopSchedulerLock, tryAcquireShopSchedulerLock } from "./shop-scheduler-lock.js";
import type { ShopSchedulerTask } from "./shop-scheduler-task.js";

export type ShopSchedulerOptions = {
  db: Database;
  log: FastifyBaseLogger;
  intervalMs: number;
  tasks: ShopSchedulerTask[];
};

export type ShopSchedulerHandle = {
  stop(): void;
};

export function createShopScheduler(options: ShopSchedulerOptions): ShopSchedulerHandle {
  let running = false;
  let stopped = false;

  const tick = async () => {
    if (stopped || running) return;
    running = true;
    const now = new Date();
    let acquired = false;
    try {
      acquired = await tryAcquireShopSchedulerLock(options.db);
      if (!acquired) return;
      for (const task of options.tasks) {
        try {
          await task.run(now);
        } catch (error) {
          options.log.error({ err: error, task: task.name }, "shop scheduler task failed");
        }
      }
    } finally {
      if (acquired) {
        await releaseShopSchedulerLock(options.db).catch((error) => {
          options.log.error({ err: error }, "shop scheduler lock release failed");
        });
      }
      running = false;
    }
  };

  void tick();
  const timer = setInterval(() => {
    void tick();
  }, options.intervalMs);
  timer.unref?.();

  return {
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}
