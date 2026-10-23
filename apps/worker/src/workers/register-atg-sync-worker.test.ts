import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAtgSyncRuntime } from "../container/create-atg-sync-runtime.js";
import { loadWorkerEnv } from "../env.js";
import type { WorkerBootstrapDeps } from "./types.js";

const bullmq = vi.hoisted(() => ({
  queueAdd: vi.fn().mockResolvedValue(undefined),
  queueClose: vi.fn().mockResolvedValue(undefined),
  workerClose: vi.fn().mockResolvedValue(undefined),
  workerOn: vi.fn(),
  workerOptions: [] as unknown[],
  processors: [] as Array<(job: { name: string; data: unknown }) => Promise<unknown>>,
}));

vi.mock("bullmq", () => ({
  UnrecoverableError: class UnrecoverableError extends Error {},
  Queue: class {
    add = bullmq.queueAdd;
    close = bullmq.queueClose;
  },
  Worker: class {
    constructor(
      _name: string,
      processor: (job: { name: string; data: unknown }) => Promise<unknown>,
      options: unknown,
    ) {
      bullmq.processors.push(processor);
      bullmq.workerOptions.push(options);
    }
    on = bullmq.workerOn;
    close = bullmq.workerClose;
  },
}));

const { registerAtgSyncWorker } = await import("./register-atg-sync-worker.js");

const ENABLED = {
  ATG_SYNC_ENABLED: "true",
  ATG_API_USERNAME: "api@example.test",
  ATG_API_PASSWORD: "not-a-real-password",
  ATG_PLATFORM_CODE: "LAX",
  ATG_INCREMENT_SET_ID: "8d3c1f2e-4b5a-4c6d-8e7f-9a0b1c2d3e4f",
  ATG_DEFAULT_CATEGORY: "Fine Art",
  S3_PUBLIC_BASE_URL: "https://media.example.test",
  ATG_POLL_INTERVAL_MS: "90000",
};

function runtime() {
  return createAtgSyncRuntime({ env: loadWorkerEnv(), db: {} as never, onTickError: vi.fn() });
}

function deps(): WorkerBootstrapDeps {
  return {
    log: { info: vi.fn(), warn: vi.fn() },
    bullConnection: { connection: {} },
    queueOpts: vi.fn().mockReturnValue({}),
    heartbeat: vi.fn().mockResolvedValue(undefined),
    reportWorkerJobFailure: vi.fn(),
  } as unknown as WorkerBootstrapDeps;
}

describe("registerAtgSyncWorker", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgres://localhost/test");
    vi.stubEnv("APP_ENV", "development");
    for (const mock of [bullmq.queueAdd, bullmq.workerOn]) mock.mockClear();
    bullmq.workerOptions.length = 0;
    bullmq.processors.length = 0;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("registers no queue, consumer or heartbeat while the flag is off", async () => {
    vi.stubEnv("ATG_SYNC_ENABLED", "");
    const handle = registerAtgSyncWorker(deps(), runtime());

    expect(handle.errorHandlers).toEqual([]);
    expect(bullmq.processors).toHaveLength(0);
    expect(bullmq.queueAdd).not.toHaveBeenCalled();
    await expect(handle.close()).resolves.toBeUndefined();
  });

  it("consumes atg-sync at concurrency 1 and schedules the repeatable tick", () => {
    for (const [key, value] of Object.entries(ENABLED)) vi.stubEnv(key, value);
    const handle = registerAtgSyncWorker(deps(), runtime());

    expect(handle.errorHandlers.map((entry) => entry.queue)).toEqual(["atg-sync"]);
    expect(bullmq.workerOptions[0]).toMatchObject({ concurrency: 1 });
    expect(bullmq.queueAdd).toHaveBeenCalledWith(
      "atg.tick",
      {},
      expect.objectContaining({ jobId: "atg-sync-tick", repeat: { every: 90_000 } }),
    );
  });

  it("makes precondition failures unrecoverable instead of retrying them", async () => {
    for (const [key, value] of Object.entries(ENABLED)) vi.stubEnv(key, value);
    registerAtgSyncWorker(deps(), runtime());

    await expect(bullmq.processors[0]?.({ name: "atg.push-sale", data: {} })).rejects.toThrow(
      /missing "saleId"/,
    );
  });
});
