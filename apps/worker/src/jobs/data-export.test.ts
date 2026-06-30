import type { ExportEntityType } from "@auction/exports";
import type { DataExportJobPayload } from "@auction/queues";
import type { Job } from "bullmq";
import { describe, expect, it, vi } from "vitest";

const rowFilters = { status: "captured" };
const authorize = vi.fn();
const streamRows = vi.fn(async function* () {
  yield { id: "pay-1" };
});

vi.mock("@auction/api/exports/providers", () => ({
  createExportProviders: () =>
    new Map([
      [
        "payments",
        {
          entityType: "payments",
          authorize,
          columns: () => [{ key: "id", header: "id" }],
          estimateCount: vi.fn(),
          streamRows,
          filterSummary: () => "status: captured",
        },
      ],
    ]),
  exportAuthContextFromRow: (row: {
    userId: string;
    userRole: string;
    userStaffRole: string | null;
  }) => ({
    userId: row.userId,
    userRole: row.userRole,
    userStaffRole: row.userStaffRole,
  }),
}));

import { dataExportJob } from "./data-export.js";

describe("dataExportJob", () => {
  it("uses persisted row filters instead of job payload filters", async () => {
    const exportId = "11111111-1111-4111-8111-111111111111";
    const row = {
      id: exportId,
      userId: "user-1",
      userRole: "staff",
      userStaffRole: "finance_ops",
      entityType: "payments",
      format: "csv",
      filters: rowFilters,
      filtersHash: "hash",
      status: "pending",
      phase: "counting",
      progress: 0,
      totalRows: 1,
      processedRows: 0,
      s3Key: null,
      fileSizeBytes: null,
      errorMessage: null,
      expiresAt: null,
      createdAt: new Date(),
      completedAt: null,
      cancelledAt: null,
    };

    const selectQueue: unknown[][] = [[row], [{ status: "pending" }]];
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(async () => selectQueue.shift() ?? []),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn().mockResolvedValue(undefined),
        })),
      })),
    };

    const storage = {
      putObjectFromFile: vi.fn().mockResolvedValue({
        url: "https://example.test/file.csv",
        byteLength: 12,
      }),
    };

    authorize.mockClear();
    streamRows.mockClear();

    await dataExportJob(
      {
        db: db as never,
        redis: { set: vi.fn().mockResolvedValue("OK") } as never,
        storage: storage as never,
        providerDeps: {} as never,
        log: { info: vi.fn(), error: vi.fn() },
      },
      {
        data: {
          exportId,
          userId: "user-1",
          entityType: "payments" as ExportEntityType,
          format: "csv",
          filters: { status: "pending" },
        },
      } as unknown as Job<DataExportJobPayload>,
    );

    const authCtx = {
      userId: row.userId,
      userRole: row.userRole,
      userStaffRole: row.userStaffRole,
    };
    expect(authorize).toHaveBeenCalledWith(authCtx, rowFilters);
    expect(streamRows).toHaveBeenCalledWith(authCtx, rowFilters);
    expect(storage.putObjectFromFile).toHaveBeenCalled();
  });
});
