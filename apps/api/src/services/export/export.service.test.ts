import type { ExportEntityType } from "@auction/exports";
import { AuthzError } from "@auction/exports/providers";
import { describe, expect, it, vi } from "vitest";
import type { ExportProvider } from "../../exports/types.js";
import type { IExportJobRepository } from "../../repositories/interfaces/export-job.repository.js";
import { ExportFileStorage } from "./export-file-storage.js";
import { RedisExportProgressStore } from "./export-progress.store.js";
import { ExportService } from "./export.service.js";

function mockProvider(overrides: Partial<ExportProvider> = {}): ExportProvider {
  return {
    entityType: "lots" as ExportEntityType,
    authorize: vi.fn(),
    columns: () => [{ key: "id", header: "id" }],
    estimateCount: vi.fn().mockResolvedValue(2),
    streamRows: async function* () {
      yield { id: "1" };
      yield { id: "2" };
    },
    filterSummary: () => "All records",
    ...overrides,
  };
}

function mockRepo(
  input: {
    rateLimitActive?: number;
    rateLimitDaily?: number;
    existingRow?: unknown;
    finalRow?: unknown;
    listRows?: unknown[];
  } = {},
): IExportJobRepository {
  return {
    countActiveSince: vi.fn().mockResolvedValue(input.rateLimitActive ?? 0),
    countSince: vi.fn().mockResolvedValue(input.rateLimitDaily ?? 0),
    findLatestByUserAndHash: vi.fn().mockResolvedValue((input.existingRow as never) ?? null),
    findById: vi.fn().mockResolvedValue((input.finalRow as never) ?? null),
    findByIdForUser: vi.fn(),
    listRecentForUser: vi.fn().mockResolvedValue((input.listRows as never) ?? []),
    insert: vi.fn().mockResolvedValue(undefined),
    updateProgress: vi.fn().mockResolvedValue(undefined),
    markCompleted: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
    markCancelled: vi.fn().mockResolvedValue(undefined),
    getStatus: vi.fn(),
  };
}

function createService(input: {
  syncMaxRows?: number;
  staleProcessingMs?: number;
  provider?: ExportProvider;
  rateLimitActive?: number;
  rateLimitDaily?: number;
  existingRow?: unknown;
  finalRow?: unknown;
  listRows?: unknown[];
  domainEventSink?: { publish: ReturnType<typeof vi.fn> };
  repo?: IExportJobRepository;
  redis?: { set: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };
}) {
  const provider = input.provider ?? mockProvider();
  const providers = new Map([["lots", provider]]);
  const repo = input.repo ?? mockRepo(input);
  const redis = input.redis ?? {
    set: vi.fn().mockResolvedValue("OK"),
    get: vi.fn().mockResolvedValue(null),
  };
  const objectStorage = { createPresignedGet: vi.fn() };
  const queue = { add: vi.fn(), getJob: vi.fn() };

  const service = new ExportService(
    repo,
    new RedisExportProgressStore(redis as never),
    new ExportFileStorage(objectStorage as never),
    queue as never,
    providers as never,
    {
      syncMaxRows: input.syncMaxRows ?? 5000,
      staleProcessingMs: input.staleProcessingMs ?? 1_800_000,
    },
    input.domainEventSink as never,
  );

  return { service, provider, repo, queue, redis };
}

describe("ExportService", () => {
  it("routes small exports synchronously and records an audit row", async () => {
    const { service, repo } = createService({ syncMaxRows: 10 });

    const result = await service.createExport({
      userId: "user-1",
      userRole: "staff",
      userStaffRole: "auction_manager",
      body: { entityType: "lots", format: "csv", filters: {} },
    });

    expect(result.mode).toBe("sync");
    expect(repo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        userRole: "staff",
        userStaffRole: "auction_manager",
        status: "processing",
      }),
    );
    if (result.mode === "sync") {
      const chunks: string[] = [];
      for await (const chunk of result.stream) chunks.push(chunk);
      expect(chunks.join("")).toContain("id");
    }
  });

  it("queues async exports when row count exceeds sync threshold", async () => {
    const provider = mockProvider({ estimateCount: vi.fn().mockResolvedValue(9000) });
    const asyncRow = {
      id: "exp-async",
      userId: "user-1",
      userRole: "staff",
      userStaffRole: "auction_manager",
      entityType: "lots",
      format: "csv",
      filters: {},
      filtersHash: "abc",
      status: "pending",
      phase: "counting",
      progress: 0,
      totalRows: 9000,
      processedRows: 0,
      s3Key: null,
      fileSizeBytes: null,
      errorMessage: null,
      expiresAt: null,
      createdAt: new Date(),
      completedAt: null,
      cancelledAt: null,
    };
    const { service, queue } = createService({
      syncMaxRows: 100,
      provider,
      finalRow: asyncRow,
    });

    const result = await service.createExport({
      userId: "user-1",
      userRole: "staff",
      userStaffRole: "auction_manager",
      body: { entityType: "lots", format: "csv", filters: {} },
    });

    expect(result.mode).toBe("async");
    expect(queue.add).toHaveBeenCalled();
  });

  it("returns existing job for reusable completed async export", async () => {
    const existingRow = {
      id: "exp-1",
      userId: "user-1",
      userRole: "staff",
      userStaffRole: "auction_manager",
      entityType: "lots",
      format: "csv",
      filters: {},
      filtersHash: "hash",
      status: "completed",
      phase: null,
      progress: 100,
      totalRows: 2,
      processedRows: 2,
      s3Key: "exports/exp-1.csv",
      fileSizeBytes: 100,
      errorMessage: null,
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      completedAt: new Date(),
      cancelledAt: null,
    };

    const { service } = createService({ existingRow });
    const result = await service.createExport({
      userId: "user-1",
      userRole: "staff",
      userStaffRole: "auction_manager",
      body: { entityType: "lots", format: "csv", filters: {} },
    });

    expect(result.mode).toBe("existing");
    if (result.mode === "existing") {
      expect(result.job.id).toBe("exp-1");
    }
  });

  it("creates a fresh export when prior sync completed export is not downloadable", async () => {
    const existingRow = {
      id: "exp-1",
      userId: "user-1",
      userRole: "staff",
      userStaffRole: "auction_manager",
      entityType: "lots",
      format: "csv",
      filters: {},
      filtersHash: "hash",
      status: "completed",
      phase: null,
      progress: 100,
      totalRows: 2,
      processedRows: 2,
      s3Key: null,
      fileSizeBytes: null,
      errorMessage: null,
      expiresAt: null,
      createdAt: new Date(),
      completedAt: new Date(),
      cancelledAt: null,
    };

    const { service, repo } = createService({ existingRow, syncMaxRows: 10 });

    const result = await service.createExport({
      userId: "user-1",
      userRole: "staff",
      userStaffRole: "auction_manager",
      body: { entityType: "lots", format: "csv", filters: {} },
    });

    expect(result.mode).toBe("sync");
    expect(repo.insert).toHaveBeenCalled();
  });

  it("creates a fresh export when prior processing export is stale", async () => {
    const existingRow = {
      id: "exp-stale",
      userId: "user-1",
      userRole: "staff",
      userStaffRole: "auction_manager",
      entityType: "lots",
      format: "csv",
      filters: {},
      filtersHash: "hash",
      status: "processing",
      phase: "writing",
      progress: 50,
      totalRows: 2,
      processedRows: 1,
      s3Key: null,
      fileSizeBytes: null,
      errorMessage: null,
      expiresAt: null,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      completedAt: null,
      cancelledAt: null,
    };

    const { service, repo } = createService({
      existingRow,
      syncMaxRows: 10,
      staleProcessingMs: 1_800_000,
    });

    const result = await service.createExport({
      userId: "user-1",
      userRole: "staff",
      userStaffRole: "auction_manager",
      body: { entityType: "lots", format: "csv", filters: {} },
    });

    expect(result.mode).toBe("sync");
    expect(repo.insert).toHaveBeenCalled();
  });

  it("publishes export.requested domain event on create", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const { service } = createService({
      syncMaxRows: 10,
      domainEventSink: { publish },
    });

    await service.createExport({
      userId: "user-1",
      userRole: "staff",
      userStaffRole: "auction_manager",
      body: { entityType: "lots", format: "csv", filters: {} },
    });

    expect(publish).toHaveBeenCalledWith(
      expect.objectContaining({
        aggregateType: "data_export",
        eventType: "export.requested",
        actorUserId: "user-1",
      }),
    );
  });

  it("does not publish domain event when returning existing export", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const existingRow = {
      id: "exp-1",
      userId: "user-1",
      userRole: "staff",
      userStaffRole: "auction_manager",
      entityType: "lots",
      format: "csv",
      filters: {},
      filtersHash: "hash",
      status: "completed",
      phase: null,
      progress: 100,
      totalRows: 2,
      processedRows: 2,
      s3Key: "exports/exp-1.csv",
      fileSizeBytes: 100,
      errorMessage: null,
      expiresAt: new Date(Date.now() + 86400000),
      createdAt: new Date(),
      completedAt: new Date(),
      cancelledAt: null,
    };
    const { service } = createService({ existingRow, domainEventSink: { publish } });

    await service.createExport({
      userId: "user-1",
      userRole: "staff",
      userStaffRole: "auction_manager",
      body: { entityType: "lots", format: "csv", filters: {} },
    });

    expect(publish).not.toHaveBeenCalled();
  });

  it("previewExport returns estimated row count", async () => {
    const provider = mockProvider({ estimateCount: vi.fn().mockResolvedValue(42) });
    const { service } = createService({ provider });

    const preview = await service.previewExport({
      userId: "user-1",
      userRole: "staff",
      userStaffRole: "auction_manager",
      body: { entityType: "lots", filters: {} },
    });

    expect(preview).toEqual({ estimatedRows: 42, syncMaxRows: 5000 });
  });

  it("listExports only reads live Redis progress for active jobs", async () => {
    const provider = mockProvider({ filterSummary: vi.fn(() => "All records") });
    const now = new Date();
    const completedRow = {
      id: "exp-completed",
      userId: "user-1",
      userRole: "staff",
      userStaffRole: "auction_manager",
      entityType: "lots",
      format: "csv",
      filters: {},
      filtersHash: "hash-completed",
      status: "completed",
      phase: null,
      progress: 100,
      totalRows: 2,
      processedRows: 2,
      s3Key: "exports/exp-completed.csv",
      fileSizeBytes: 100,
      errorMessage: null,
      expiresAt: new Date(Date.now() + 86_400_000),
      createdAt: now,
      completedAt: now,
      cancelledAt: null,
    };
    const activeRow = {
      ...completedRow,
      id: "exp-active",
      filtersHash: "hash-active",
      status: "processing",
      phase: "writing",
      progress: 20,
      s3Key: null,
      expiresAt: null,
      completedAt: null,
    };
    const redis = {
      get: vi
        .fn()
        .mockResolvedValue(JSON.stringify({ phase: "writing", processedRows: 1, totalRows: 5 })),
      set: vi.fn(),
    };
    const { service } = createService({
      provider,
      listRows: [completedRow, activeRow],
      redis,
    });

    const jobs = await service.listExports("user-1");

    expect(jobs).toHaveLength(2);
    expect(redis.get).toHaveBeenCalledTimes(1);
    expect(redis.get).toHaveBeenCalledWith("export:progress:exp-active");
    expect(provider.filterSummary).not.toHaveBeenCalled();
    expect(jobs[1]?.processedRows).toBe(1);
  });

  it("enforces daily export limits", async () => {
    const { service } = createService({
      rateLimitDaily: 20,
    });

    await expect(
      service.createExport({
        userId: "user-1",
        userRole: "staff",
        userStaffRole: "auction_manager",
        body: { entityType: "lots", format: "csv", filters: {} },
      }),
    ).rejects.toThrow(AuthzError);
  });
});
