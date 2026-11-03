import type {
  IKycRetentionSubjectStore,
  RecordCounts,
} from "../interfaces/kyc-retention-subject.store.js";
import type { UploadStorage } from "../lib/upload-storage.js";
import {
  isRetentionExpired,
  latestClosureThatCanBeDue,
  relationshipEndedAt,
} from "../retention/kyc-retention-policy.js";

const DEFAULT_BATCH_SIZE = 25;
const PAGE_SIZE = 100;

type Logger = {
  info: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
};

export type KycRetentionPurgeSummary = {
  dryRun: boolean;
  /** Subjects whose retention has expired and that still hold records. */
  due: number;
  /** Subjects purged this run; always 0 in a dry run. */
  purged: number;
  failed: number;
};

/**
 * Purges KYC, AML and source-of-funds records whose five-year retention has expired (see
 * `kyc-retention-policy.ts`). Idempotent: a purged subject holds nothing, so a rerun skips it. It
 * purges at most `batchSize` subjects a run and deletes nothing unless `dryRun` is false.
 *
 * Files go first. A failed file delete leaves the rows, so the next run retries; the reverse order
 * could leave files nothing points at.
 */
export async function purgeKycRetentionJob(input: {
  stores: readonly IKycRetentionSubjectStore[];
  storage: Pick<UploadStorage, "deleteObject">;
  log: Logger;
  dryRun: boolean;
  batchSize?: number;
  now?: Date;
}): Promise<KycRetentionPurgeSummary> {
  const now = input.now ?? new Date();
  const batchSize = input.batchSize ?? DEFAULT_BATCH_SIZE;
  const closedBefore = latestClosureThatCanBeDue(now);
  const summary: KycRetentionPurgeSummary = { dryRun: input.dryRun, due: 0, purged: 0, failed: 0 };

  for (const store of input.stores) {
    let afterId: string | null = null;
    for (;;) {
      if (summary.purged >= batchSize) break;
      const page = await store.listCandidates({ closedBefore, afterId, limit: PAGE_SIZE });
      if (page.length === 0) break;

      for (const candidate of page) {
        afterId = candidate.subjectId;
        if (summary.purged >= batchSize) break;
        const endedAt = relationshipEndedAt(candidate);
        if (!isRetentionExpired(endedAt, now)) continue;

        const holding = await store.describeHolding(candidate.subjectId);
        if (Object.keys(holding.records).length === 0) continue;
        summary.due += 1;
        const fields = {
          subjectKind: store.kind,
          subjectId: candidate.subjectId,
          relationshipEndedAt: endedAt.toISOString(),
          records: holding.records,
          files: holding.storageKeys.length,
        };

        if (input.dryRun) {
          input.log.info(fields, "kyc_retention_purge_would_purge");
          continue;
        }
        try {
          for (const key of holding.storageKeys) await input.storage.deleteObject(key);
          const purged: RecordCounts = await store.erase(candidate.subjectId, {
            relationshipEndedAt: endedAt,
            purgedAt: now,
          });
          summary.purged += 1;
          input.log.info({ ...fields, records: purged }, "kyc_retention_purge_purged");
        } catch (error) {
          summary.failed += 1;
          input.log.error({ ...fields, error }, "kyc_retention_purge_failed");
        }
      }
      if (page.length < PAGE_SIZE) break;
    }
  }

  input.log.info({ ...summary }, "kyc_retention_purge_done");
  if (summary.failed > 0) {
    throw new Error(`KYC retention purge failed for ${summary.failed} subject(s); will retry`);
  }
  return summary;
}
