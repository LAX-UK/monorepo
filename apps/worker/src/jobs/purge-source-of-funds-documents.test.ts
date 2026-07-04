import { describe, expect, it, vi } from "vitest";
import type { ISourceOfFundsDocumentPurgeRepository } from "../interfaces/source-of-funds-document-purge.repository.js";
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

    const sourceOfFundsDocumentPurgeRepo = {
      findTerminalCasesPastRetention: vi.fn().mockResolvedValue([{ id: "sof-1", reviewedAt }]),
      findDocumentsToPurge: vi.fn().mockResolvedValue([doc]),
      anonymizeDocument: vi.fn().mockResolvedValue(undefined),
      deleteDocumentReviews: vi.fn().mockResolvedValue(undefined),
    } as unknown as ISourceOfFundsDocumentPurgeRepository;
    const deleteObject = vi.fn().mockResolvedValue(undefined);

    const result = await purgeSourceOfFundsDocumentsJob({
      sourceOfFundsDocumentPurgeRepo,
      storage: { deleteObject } as never,
      log: { info: vi.fn() },
      retentionYears: 5,
      now,
    });

    expect(result.purged).toBe(1);
    expect(deleteObject).toHaveBeenCalledWith(doc.key);
    expect(sourceOfFundsDocumentPurgeRepo.deleteDocumentReviews).toHaveBeenCalledWith(doc.id);
    expect(sourceOfFundsDocumentPurgeRepo.anonymizeDocument).toHaveBeenCalledWith(doc.id, now);
  });

  it("returns zero when no terminal cases exceed retention", async () => {
    const sourceOfFundsDocumentPurgeRepo = {
      findTerminalCasesPastRetention: vi.fn().mockResolvedValue([]),
      findDocumentsToPurge: vi.fn(),
      anonymizeDocument: vi.fn(),
      deleteDocumentReviews: vi.fn(),
    } as unknown as ISourceOfFundsDocumentPurgeRepository;

    const result = await purgeSourceOfFundsDocumentsJob({
      sourceOfFundsDocumentPurgeRepo,
      storage: { deleteObject: vi.fn() } as never,
      log: { info: vi.fn() },
      now: new Date("2026-06-01T00:00:00.000Z"),
    });

    expect(result.purged).toBe(0);
  });
});
