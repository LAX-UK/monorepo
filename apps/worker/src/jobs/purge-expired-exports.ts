import { DEFAULT_EXPORT_STALE_PROCESSING_MS } from "@auction/exports";
import type { IDataExportJobRepository } from "../interfaces/data-export.repository.js";
import type { UploadStorage } from "../lib/upload-storage.js";

export async function purgeExpiredExportsJob(input: {
  dataExportRepo: IDataExportJobRepository;
  storage: UploadStorage;
  log: { info: (o: unknown, msg?: string) => void };
  staleProcessingMs?: number;
}): Promise<{ deleted: number; markedFailed: number }> {
  const now = new Date();
  const staleProcessingMs = input.staleProcessingMs ?? DEFAULT_EXPORT_STALE_PROCESSING_MS;
  const staleCutoff = new Date(now.getTime() - staleProcessingMs);

  const stuck = await input.dataExportRepo.findStuckProcessing(staleCutoff, 200);

  let markedFailed = 0;
  for (const row of stuck) {
    await input.dataExportRepo.markTimedOut(row.id);
    markedFailed += 1;
  }

  const stale = await input.dataExportRepo.findExpired(now, 200);

  let deleted = 0;
  for (const row of stale) {
    if (row.s3Key) {
      try {
        await input.storage.deleteObject(row.s3Key);
      } catch {
        /* best-effort object cleanup */
      }
    }
    await input.dataExportRepo.deleteById(row.id);
    deleted += 1;
  }

  const retentionCutoff = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const oldRows = await input.dataExportRepo.findOlderThan(retentionCutoff, 500);
  for (const row of oldRows) {
    if (row.s3Key) {
      try {
        await input.storage.deleteObject(row.s3Key);
      } catch {
        /* ignore */
      }
    }
    await input.dataExportRepo.deleteById(row.id);
    deleted += 1;
  }

  input.log.info({ deleted, markedFailed }, "purge_expired_exports");
  return { deleted, markedFailed };
}
