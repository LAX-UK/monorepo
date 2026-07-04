import type { Logger } from "pino";
import type { IQrCodeScanPurgeRepository } from "../interfaces/qr-code-scan-purge.repository.js";

const DEFAULT_RETENTION_DAYS = 90;
const DEFAULT_BATCH_SIZE = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function purgeQrCodeScans(input: {
  qrCodeScanPurgeRepo: IQrCodeScanPurgeRepository;
  log: Logger;
  retentionDays?: number;
  batchSize?: number;
  now?: Date;
}): Promise<{ deleted: number; cutoff: Date }> {
  const retentionDays = input.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const batchSize = input.batchSize ?? DEFAULT_BATCH_SIZE;
  const cutoff = new Date((input.now ?? new Date()).getTime() - retentionDays * DAY_MS);
  let deleted = 0;

  for (;;) {
    const { deleted: batchDeleted, batchCount } = await input.qrCodeScanPurgeRepo.purgeBefore(
      cutoff,
      batchSize,
    );
    if (batchCount === 0) break;
    deleted += batchDeleted;
    if (batchCount < batchSize) break;
  }

  if (deleted > 0) {
    input.log.info({ deleted, cutoff, retentionDays }, "purged stale QR code scan rows");
  }
  return { deleted, cutoff };
}
