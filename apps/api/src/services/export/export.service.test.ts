import type { ExportEntityType } from "@auction/exports";
import { describe, expect, it, vi } from "vitest";
import type { ExportProvider } from "../../exports/types.js";
import { AuthzError } from "../../lib/errors.js";
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

function buildSelectChain(results: {
  rateLimitActive?: number;
  rateLimitDaily?: number;
  existingRow?: unknown;
  finalRow?: unknown;
}) {
  let whereCalls = 0;
  const limit = vi
    .fn()
    .mockImplementation(async () => (results.existingRow ? [results.existingRow] : []));
  const orderBy = vi.fn().mockReturnValue({ limit });
  const where = vi.fn().mockImplementation(() => {
    whereCalls += 1;
    if (whereCalls === 1) {
      return Promise.resolve([{ n: results.rateLimitActive ?? 0 }]);
    }
    if (whereCalls === 2) {
      return Promise.resolve([{ n: results.rateLimitDaily ?? 0 }]);
    }
    if (whereCalls === 3) {
      return { orderBy };
    }
    return Promise.resolve(results.finalRow ? [results.finalRow] : []);
  });
  return {
    from: vi.fn().mockReturnValue({ where, orderBy, limit }),
    where,
    orderBy,
    limit,
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
  domainEventPublisher?: { publish: ReturnType<typeof vi.fn> };
}) {
  const provider = input.provider ?? mockProvider();
  const providers = new Map([["lots", provider]]);

  const selectChain = buildSelectChain({
    ...(input.rateLimitActive !== undefined ? { rateLimitActive: input.rateLimitActive } : {}),
    ...(input.rateLimitDaily !== undefined ? { rateLimitDaily: input.rateLimitDaily } : {}),
    ...(input.existingRow !== undefined ? { existingRow: input.existingRow } : {}),
    ...(input.finalRow !== undefined ? { finalRow: input.finalRow } : {}),
  });

  const db = {
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    }),
  };

  const redis = { set: vi.fn().mockResolvedValue("OK"), get: vi.fn().mockResolvedValue(null) };
  const objectStorage = { createPresignedGet: vi.fn() };
  const queue = { add: vi.fn(), getJob: vi.fn() };

  const service = new ExportService(
    db as never,
    redis as never,
    objectStorage as never,
    queue as never,
    providers as never,
    {
      syncMaxRows: input.syncMaxRows ?? 5000,
      staleProcessingMs: input.staleProcessingMs ?? 1_800_000,
    },
    input.domainEventPublisher as never,
  );

  return { service, provider, db, queue };
}

describe("ExportService", () => {
  it("routes small exports synchronously and records an audit row", async () => {
    const { service, db } = createService({ syncMaxRows: 10 });
    const insertValues = vi.fn().mockResolvedValue(undefined);
    db.insert = vi.fn().mockReturnValue({ values: insertValues });

    const result = await service.createExport({
      userId: "user-1",
      userRole: "staff",
      userStaffRole: "auction_manager",
      body: { entityType: "lots", format: "csv", filters: {} },
    });

    expect(result.mode).toBe("sync");
    expect(insertValues).toHaveBeenCalledWith(
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

    const insertValues = vi.fn().mockResolvedValue(undefined);
    const { service, db } = createService({ existingRow, syncMaxRows: 10 });
    db.insert = vi.fn().mockReturnValue({ values: insertValues });

    const result = await service.createExport({
      userId: "user-1",
      userRole: "staff",
      userStaffRole: "auction_manager",
      body: { entityType: "lots", format: "csv", filters: {} },
    });

    expect(result.mode).toBe("sync");
    expect(insertValues).toHaveBeenCalled();
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

    const insertValues = vi.fn().mockResolvedValue(undefined);
    const { service, db } = createService({
      existingRow,
      syncMaxRows: 10,
      staleProcessingMs: 1_800_000,
    });
    db.insert = vi.fn().mockReturnValue({ values: insertValues });

    const result = await service.createExport({
      userId: "user-1",
      userRole: "staff",
      userStaffRole: "auction_manager",
      body: { entityType: "lots", format: "csv", filters: {} },
    });

    expect(result.mode).toBe("sync");
    expect(insertValues).toHaveBeenCalled();
  });

  it("publishes export.requested domain event on create", async () => {
    const publish = vi.fn().mockResolvedValue(undefined);
    const insertValues = vi.fn().mockResolvedValue(undefined);
    const { service, db } = createService({
      syncMaxRows: 10,
      domainEventPublisher: { publish },
    });
    db.insert = vi.fn().mockReturnValue({ values: insertValues });

    await service.createExport({
      userId: "user-1",
      userRole: "staff",
      userStaffRole: "auction_manager",
      body: { entityType: "lots", format: "csv", filters: {} },
    });

    expect(publish).toHaveBeenCalledWith(
      expect.anything(),
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
    const { service } = createService({ existingRow, domainEventPublisher: { publish } });

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
