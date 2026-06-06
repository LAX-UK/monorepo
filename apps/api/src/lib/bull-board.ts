import {
  QUEUE_REGISTRY,
  type QueueName,
  bullBoardAllowRetries,
  bullBoardReadOnlyInProd,
  createBullQueueOptions,
  listBullBoardQueues,
} from "@auction/queues";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { HonoAdapter } from "@bull-board/hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { type ConnectionOptions, Queue } from "bullmq";
import type { MiddlewareHandler } from "hono";
import type { Hono } from "hono";
import type { Env } from "../env.js";
import { queueRuntimeEnvFromApiEnv } from "./queue-runtime-env.js";

export type BullBoardMiddleware = {
  requireAuth: MiddlewareHandler;
  requirePlatformShell: MiddlewareHandler;
  requireSuperAdminStaffRole: MiddlewareHandler;
  auditAccess: MiddlewareHandler;
};

let bullBoardQueueInstances: Map<QueueName, Queue> | undefined;

export function assertBullBoardProductionSafety(env: Env): void {
  if (env.APP_ENV !== "production") return;
  for (const [name, def] of Object.entries(QUEUE_REGISTRY)) {
    if (def.criticality === "high" && def.allowUiRetries) {
      throw new Error(`bull_board_unsafe_config: ${name} has allowUiRetries=true in production`);
    }
  }
}

export async function closeBullBoardQueues(): Promise<void> {
  if (!bullBoardQueueInstances) return;
  await Promise.allSettled([...bullBoardQueueInstances.values()].map((queue) => queue.close()));
  bullBoardQueueInstances.clear();
  bullBoardQueueInstances = undefined;
}

export function mountBullBoard(
  parent: Hono,
  bullConnection: ConnectionOptions,
  env: Env,
  middleware: BullBoardMiddleware,
): void {
  if (!env.ENABLE_BULL_BOARD) return;

  const runtimeEnv = queueRuntimeEnvFromApiEnv(env);
  const serverAdapter = new HonoAdapter(serveStatic);
  const queueInstances = new Map<QueueName, Queue>();
  bullBoardQueueInstances = queueInstances;

  const getQueue = (name: QueueName): Queue => {
    const cached = queueInstances.get(name);
    if (cached) return cached;
    const queue = new Queue(name, createBullQueueOptions(name, { connection: bullConnection }));
    queueInstances.set(name, queue);
    return queue;
  };

  const queues = listBullBoardQueues(runtimeEnv).map(
    ({ name, def }) =>
      new BullMQAdapter(getQueue(name), {
        readOnlyMode: bullBoardReadOnlyInProd(name, env.APP_ENV),
        allowRetries: bullBoardAllowRetries(name, env.APP_ENV),
        description: def.description,
      }),
  );

  createBullBoard({
    queues,
    serverAdapter,
    options: {
      uiConfig: {
        boardTitle: "Auction Job Queues",
      },
    },
  });

  serverAdapter.setBasePath("/admin/system/job-queues");

  const boardPath = "/admin/system/job-queues";
  for (const mw of [
    middleware.requireAuth,
    middleware.requirePlatformShell,
    middleware.requireSuperAdminStaffRole,
    middleware.auditAccess,
  ]) {
    parent.use(boardPath, mw);
    parent.use(`${boardPath}/*`, mw);
  }
  parent.route(boardPath, serverAdapter.registerPlugin());
}
