import { partyEvidenceHold } from "@auction/domain";
import type {
  IKycRetentionSubjectStore,
  RecordCounts,
} from "../interfaces/kyc-retention-subject.store.js";
import type { UploadStorage } from "../lib/upload-storage.js";
import type {
  IRetentionHoldAlerts,
  RetentionHoldAttention,
} from "../retention/kyc-retention-hold-alert.js";
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
  /** Subjects whose evidence is kept because a private sale deal's record is still retained. */
  heldForDeals: number;
  /** Of those, subjects held by a deal that has no end date, which nothing will release by itself. */
  heldWithoutEnd: number;
  /** Of those, subjects held by an open deal that has not changed stage for longer than the retention. */
  heldByStaleDeal: number;
  /** Subjects purged this run; always 0 in a dry run. */
  purged: number;
  failed: number;
};

/**
 * Purges KYC, AML and source-of-funds records whose five-year retention has expired (see
 * `kyc-retention-policy.ts`) and that no retained private sale deal still needs: someone who is,
 * or was ever named as, a party to a deal keeps their evidence until the deal's record has run its
 * own retention too. Idempotent: a purged subject holds nothing, so a rerun skips it. It
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
  /** Years a private sale's record is kept after the deal ends; its parties' evidence is kept as long. */
  privateSaleRetentionYears: number;
  /** Told when a hold needs a person to look at it; absent where nobody is to be told. */
  alerts?: IRetentionHoldAlerts;
  batchSize?: number;
  now?: Date;
}): Promise<KycRetentionPurgeSummary> {
  const now = input.now ?? new Date();
  const batchSize = input.batchSize ?? DEFAULT_BATCH_SIZE;
  const closedBefore = latestClosureThatCanBeDue(now);
  const attention: RetentionHoldAttention[] = [];
  const summary: KycRetentionPurgeSummary = {
    dryRun: input.dryRun,
    due: 0,
    heldForDeals: 0,
    heldWithoutEnd: 0,
    heldByStaleDeal: 0,
    purged: 0,
    failed: 0,
  };

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

        // The evidence goes only when both clocks have run out: the subject's own five years
        // (above) and the retention of every private sale deal they were named on.
        const deals = await store.dealRecords(candidate.subjectId);
        const hold = partyEvidenceHold(deals, now, input.privateSaleRetentionYears);
        if (hold.held) {
          summary.heldForDeals += 1;
          if (hold.withoutEnd) summary.heldWithoutEnd += 1;
          if (hold.stale) summary.heldByStaleDeal += 1;
          for (const reason of hold.reasons) {
            if (reason.kind === "end_unknown") {
              attention.push({ reference: reason.reference, kind: "no_end" });
            } else if (reason.stale) {
              attention.push({ reference: reason.reference, kind: "stale" });
            }
          }
          input.log.info(
            {
              subjectKind: store.kind,
              subjectId: candidate.subjectId,
              holds: hold.reasons.map((reason) => ({
                deal: reason.reference,
                kind: reason.kind,
                heldUntil: reason.heldUntil?.toISOString() ?? null,
                stale: reason.stale,
              })),
            },
            "kyc_retention_purge_held_for_private_sale_deal",
          );
          continue;
        }

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

  await alertAboutHolds(input.alerts, attention, input.log);
  input.log.info({ ...summary }, "kyc_retention_purge_done");
  if (summary.failed > 0) {
    throw new Error(`KYC retention purge failed for ${summary.failed} subject(s); will retry`);
  }
  return summary;
}

/**
 * Tells compliance about holds that need a person, once per deal however many people it holds. A
 * failure to tell is logged and never stops the purge: the holds still hold.
 */
async function alertAboutHolds(
  alerts: IRetentionHoldAlerts | undefined,
  attention: readonly RetentionHoldAttention[],
  log: Logger,
): Promise<void> {
  if (!alerts || attention.length === 0) return;
  const seen = new Set<string>();
  const unique = attention.filter((hold) => {
    const key = `${hold.reference}:${hold.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  try {
    await alerts.needAttention(unique);
  } catch (error) {
    log.error({ error }, "kyc_retention_hold_alert_failed");
  }
}
