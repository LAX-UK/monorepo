import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadWorkerEnv } from "../env.js";
import type { WorkerBootstrapDeps } from "./types.js";

const bullmq = vi.hoisted(() => ({
  queueAdd: vi.fn().mockResolvedValue(undefined),
  queueClose: vi.fn().mockResolvedValue(undefined),
  workerClose: vi.fn().mockResolvedValue(undefined),
  workerOn: vi.fn(),
  workerOptions: [] as unknown[],
  queueNames: [] as string[],
  processors: [] as Array<(job: unknown) => Promise<unknown>>,
}));

vi.mock("bullmq", () => ({
  UnrecoverableError: class UnrecoverableError extends Error {},
  DelayedError: class DelayedError extends Error {},
  Queue: class {
    constructor(name: string) {
      bullmq.queueNames.push(name);
    }
    add = bullmq.queueAdd;
    close = bullmq.queueClose;
  },
  Worker: class {
    constructor(_name: string, processor: (job: unknown) => Promise<unknown>, options: unknown) {
      bullmq.processors.push(processor);
      bullmq.workerOptions.push(options);
    }
    on = bullmq.workerOn;
    close = bullmq.workerClose;
  },
}));

const runtime = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("../subject-export/create-subject-export-runtime.js", () => ({
  createSubjectExportRuntime: () => ({ assembler: { run: runtime.run }, ledger: {}, store: {} }),
}));

const { DelayedError } = await import("bullmq");
const { registerSubjectExportWorker } = await import("./register-subject-export-worker.js");

const CONFIGURED = {
  IDENTITY_INTERNAL_BASE_URL: "https://identity.internal",
  SHOP_API_INTERNAL_BASE_URL: "https://shop-api.internal",
  SUBJECT_EXPORT_MACHINE_CLIENT_ID: "subject-export-worker",
  SUBJECT_EXPORT_MACHINE_CLIENT_SECRET: "x".repeat(32),
  IDENTITY_SUBJECT_EXPORT_CLIENT_ID: "subject-export",
  IDENTITY_SUBJECT_EXPORT_CLIENT_SECRET: "y".repeat(32),
  SUBJECT_EXPORT_BUCKET: "lax-subject-exports",
  SUBJECT_EXPORT_REGION: "eu-west-2",
  SUBJECT_EXPORT_WRITE_ACCESS_KEY_ID: "AKIAEXPORT",
  SUBJECT_EXPORT_WRITE_SECRET_ACCESS_KEY: "write-secret",
};

function deps(): WorkerBootstrapDeps {
  return {
    env: loadWorkerEnv(),
    log: { info: vi.fn(), warn: vi.fn() },
    bullConnection: { connection: {} },
    queueOpts: vi.fn().mockReturnValue({}),
    heartbeat: vi.fn().mockResolvedValue(undefined),
    reportWorkerJobFailure: vi.fn(),
  } as unknown as WorkerBootstrapDeps;
}

describe("registerSubjectExportWorker", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
    vi.stubEnv("APP_ENV", "development");
    for (const mock of [bullmq.queueAdd, bullmq.workerOn]) mock.mockClear();
    bullmq.workerOptions.length = 0;
    bullmq.processors.length = 0;
    bullmq.queueNames.length = 0;
  });

  afterEach(() => vi.unstubAllEnvs());

  it("keeps the queue but starts no consumer while the feature is not configured", async () => {
    const handle = registerSubjectExportWorker(deps());
    expect(bullmq.queueNames).toEqual(["subject-data-export"]);
    expect(bullmq.processors).toHaveLength(0);
    expect(handle.errorHandlers).toEqual([]);
    expect(handle.dlqHandlers).toEqual([]);
    await expect(handle.close()).resolves.toBeUndefined();
  });

  it("consumes the queue one copy at a time and schedules the hourly purge", () => {
    for (const [key, value] of Object.entries(CONFIGURED)) vi.stubEnv(key, value);
    const handle = registerSubjectExportWorker(deps());

    expect(bullmq.workerOptions[0]).toMatchObject({ concurrency: 1 });
    expect(handle.errorHandlers.map((entry) => entry.queue)).toEqual(["subject-data-export"]);
    expect(handle.dlqHandlers.map((entry) => entry.name)).toEqual(["subject-data-export"]);
    expect(bullmq.queueAdd).toHaveBeenCalledWith(
      "purge-objects",
      {},
      expect.objectContaining({
        jobId: "subject-data-export-purge",
        repeat: { every: 3_600_000 },
        attempts: 1,
      }),
    );
  });

  it("hands the relay an observer that queues an assemble job keyed by the export id", async () => {
    const handle = registerSubjectExportWorker(deps());
    const exportId = "11111111-1111-4111-8111-111111111111";
    await handle.relayObserver([
      {
        eventType: "subject.data_export_requested",
        aggregateId: exportId,
        payload: { schemaVersion: 1, subjectId: "subject-1", exportId },
      },
    ]);
    expect(bullmq.queueAdd).toHaveBeenCalledWith(
      "assemble",
      { exportId, subjectId: "subject-1" },
      { jobId: `subject-data-export__${exportId}` },
    );
  });

  it("moves a copy to the delayed set, without failing it, when the temp disk is low", async () => {
    for (const [key, value] of Object.entries(CONFIGURED)) vi.stubEnv(key, value);
    const { SubjectExportDeferredError } = await import("../subject-export/export-disk-guard.js");
    runtime.run.mockRejectedValueOnce(new SubjectExportDeferredError(1, 2));
    registerSubjectExportWorker(deps());
    const moveToDelayed = vi.fn().mockResolvedValue(undefined);
    const job = {
      name: "assemble",
      data: { exportId: "e", subjectId: "s" },
      opts: { attempts: 13 },
      timestamp: 0,
      attemptsMade: 0,
      attemptsStarted: 1,
      moveToDelayed,
    };
    const processor = bullmq.processors.at(-1) as (j: unknown, token?: string) => Promise<unknown>;
    await expect(processor(job, "tok")).rejects.toBeInstanceOf(DelayedError);
    expect(moveToDelayed).toHaveBeenCalledWith(expect.any(Number), "tok");
  });
});
