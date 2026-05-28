import type { Database } from "@auction/db";
import { dataExport } from "@auction/db/schema";
import { DEFAULT_EXPORT_STALE_PROCESSING_MS } from "@auction/exports";
import { and, eq, inArray, lt } from "drizzle-orm";
import type { UploadStorage } from "../lib/upload-storage.js";

export async function purgeExpiredExportsJob(input: {
  db: Database;
  storage: UploadStorage;
  log: { info: (o: unknown, msg?: string) => void };
  staleProcessingMs?: number;
}): Promise<{ deleted: number; markedFailed: number }> {
  const now = new Date();
  const staleProcessingMs = input.staleProcessingMs ?? DEFAULT_EXPORT_STALE_PROCESSING_MS;
  const staleCutoff = new Date(now.getTime() - staleProcessingMs);

  const stuck = await input.db
    .select()
    .from(dataExport)
    .where(
      and(
        inArray(dataExport.status, ["pending", "processing"]),
        lt(dataExport.createdAt, staleCutoff),
      ),
    )
    .limit(200);

  let markedFailed = 0;
  for (const row of stuck) {
    await input.db
      .update(dataExport)
      .set({
        status: "failed",
        errorMessage: "Export timed out",
        phase: null,
      })
      .where(eq(dataExport.id, row.id));
    markedFailed += 1;
  }

  const stale = await input.db
    .select()
    .from(dataExport)
    .where(lt(dataExport.expiresAt, now))
    .limit(200);

  let deleted = 0;
  for (const row of stale) {
    if (row.s3Key) {
      try {
        await input.storage.deleteObject(row.s3Key);
      } catch {
        /* best-effort object cleanup */
      }
    }
    await input.db.delete(dataExport).where(eq(dataExport.id, row.id));
    deleted += 1;
  }

  const retentionCutoff = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const oldRows = await input.db
    .select()
    .from(dataExport)
    .where(lt(dataExport.createdAt, retentionCutoff))
    .limit(500);
  for (const row of oldRows) {
    if (row.s3Key) {
      try {
        await input.storage.deleteObject(row.s3Key);
      } catch {
        /* ignore */
      }
    }
    await input.db.delete(dataExport).where(eq(dataExport.id, row.id));
    deleted += 1;
  }

  input.log.info({ deleted, markedFailed }, "purge_expired_exports");
  return { deleted, markedFailed };
}
