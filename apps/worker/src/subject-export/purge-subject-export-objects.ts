import type { SubjectExportArchiveStore } from "./archive-store.js";
import type { SubjectExportPurgePort } from "./identity-export-client.js";

const BATCH_SIZE = 100;

export type PurgeLog = {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
};

export type PurgeResult = { purged: number; failed: number };

/**
 * Deletes the stored copies Identity has asked to be removed (the person deleted the copy, or it
 * passed its seven days) and tells Identity each one is gone. A key outside the request's own
 * folder is refused, so a wrong answer from Identity can never delete another object. One failed
 * delete does not hold up the others; it stays pending and the next run tries it again. The
 * bucket's 8-day lifecycle rule is the backstop for anything this job cannot reach.
 */
export async function purgeSubjectExportObjects(deps: {
  ledger: SubjectExportPurgePort;
  store: SubjectExportArchiveStore;
  log: PurgeLog;
}): Promise<PurgeResult> {
  const { ledger, store, log } = deps;
  const result: PurgeResult = { purged: 0, failed: 0 };
  for (const { exportId, objectKey } of await ledger.pending(BATCH_SIZE)) {
    if (!objectKey.startsWith(`subject-exports/${exportId}/`)) {
      log.warn({ exportId }, "subject export purge refused an object key outside its folder");
      result.failed += 1;
      continue;
    }
    try {
      await store.deleteObject(objectKey);
      await ledger.confirmPurged(exportId);
      result.purged += 1;
    } catch (error) {
      log.warn({ exportId, err: error }, "subject export object could not be purged");
      result.failed += 1;
    }
  }
  if (result.purged > 0) log.info({ purged: result.purged }, "subject export objects purged");
  return result;
}
