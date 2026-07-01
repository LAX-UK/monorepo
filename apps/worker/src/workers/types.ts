import type { DrizzleRepositoryFactory } from "@auction/api/exports/repository-factory";
import type { createDb } from "@auction/db";
import type { QueueName } from "@auction/queues";
import type { QueueOptions, WorkerOptions } from "bullmq";
import type { Redis } from "ioredis";
import type { Logger } from "pino";
import type { WorkerEnv } from "../env.js";
import type { IMalwareScanner } from "../lib/malware-scanner.js";
import type { SharpImageProcessor } from "../lib/sharp-image-processor.js";
import type { createUploadStorage } from "../lib/upload-storage.js";

export type WorkerDb = ReturnType<typeof createDb>;

export type WorkerErrorHandlerEntry = { worker: import("bullmq").Worker; queue: string };

export type DlqHandlerEntry = { name: QueueName; worker: import("bullmq").Worker };

export type BullConnection = WorkerOptions;

export type WorkerBootstrapDeps = {
  env: WorkerEnv;
  db: WorkerDb;
  redis: Redis;
  log: Logger;
  bullConnection: BullConnection;
  queueOpts: (name: QueueName) => QueueOptions;
  uploadStorage: ReturnType<typeof createUploadStorage>;
  malwareScanner: IMalwareScanner;
  imageProcessor: SharpImageProcessor;
  publicUploadBase: string | undefined;
  repoFactory: DrizzleRepositoryFactory;
  sentryMonitorSlugs: Record<string, string>;
  heartbeat: (queue: string) => Promise<void>;
  reportWorkerJobFailure: (queue: string, job: { id?: string } | undefined, err: Error) => void;
};
