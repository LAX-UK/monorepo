import { describe, expect, it, vi } from "vitest";
import { purgeSourceOfFundsDocumentsJob } from "./purge-source-of-funds-documents.js";

describe("purgeSourceOfFundsDocumentsJob", () => {
  it("anonymizes documents for cases past AML retention", async () => {
    const now = new Date("2031-06-01T00:00:00.000Z");
    const reviewedAt = new Date("2025-01-01T00:00:00.000Z");
    const doc = {
      id: "doc-1",
      uploadObjectId: "up-1",
      key: "uploads/active/source-of-funds/secret.pdf",
    };

    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const deleteWhere = vi.fn().mockResolvedValue(undefined);
    const db = {
      select: vi
        .fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "sof-1", reviewedAt }]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([doc]),
              }),
            }),
          }),
        }),
      update: vi.fn().mockReturnValue({ set }),
      delete: vi.fn().mockReturnValue({ where: deleteWhere }),
    };
    const deleteObject = vi.fn().mockResolvedValue(undefined);

    const result = await purgeSourceOfFundsDocumentsJob({
      db: db as never,
      storage: { deleteObject } as never,
      log: { info: vi.fn() },
      retentionYears: 5,
      now,
    });

    expect(result.purged).toBe(1);
    expect(deleteObject).toHaveBeenCalledWith(doc.key);
    expect(deleteWhere).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        anonymizedAt: now,
        label: null,
        reviewStatus: "superseded",
      }),
    );
  });

  it("returns zero when no terminal cases exceed retention", async () => {
    const db = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
    };

    const result = await purgeSourceOfFundsDocumentsJob({
      db: db as never,
      storage: { deleteObject: vi.fn() } as never,
      log: { info: vi.fn() },
      now: new Date("2026-06-01T00:00:00.000Z"),
    });

    expect(result.purged).toBe(0);
  });
});
