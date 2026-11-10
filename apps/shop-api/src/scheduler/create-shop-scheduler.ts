import type { Database } from "@auction/db";
import type { FastifyBaseLogger } from "fastify";
import { runWithShopSchedulerLock } from "./shop-scheduler-lock.js";
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
    try {
      await runWithShopSchedulerLock(options.db, async () => {
        for (const task of options.tasks) {
          try {
            await task.run(now);
          } catch (error) {
            options.log.error({ err: error, task: task.name }, "shop scheduler task failed");
          }
        }
      });
    } catch (error) {
      // The lock connection could not be had (for example a database still starting on a fresh
      // pod). Nothing is held; the next interval tries again, so this is a warning, not a crash.
      options.log.warn({ err: error }, "shop scheduler tick skipped: could not take the lock");
    } finally {
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
