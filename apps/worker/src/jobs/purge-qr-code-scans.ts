import type { Database } from "@auction/db";
import { qrCodeScan } from "@auction/db/schema";
import { inArray, lt } from "drizzle-orm";
import type { Logger } from "pino";

const DEFAULT_RETENTION_DAYS = 90;
const DEFAULT_BATCH_SIZE = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function purgeQrCodeScans(input: {
  db: Database;
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
    const rows = await input.db
      .select({ id: qrCodeScan.id })
      .from(qrCodeScan)
      .where(lt(qrCodeScan.scannedAt, cutoff))
      .limit(batchSize);
    if (rows.length === 0) break;

    const removed = await input.db
      .delete(qrCodeScan)
      .where(
        inArray(
          qrCodeScan.id,
          rows.map((row) => row.id),
        ),
      )
      .returning({ id: qrCodeScan.id });
    deleted += removed.length;

    if (rows.length < batchSize) break;
  }

  if (deleted > 0) {
    input.log.info({ deleted, cutoff, retentionDays }, "purged stale QR code scan rows");
  }
  return { deleted, cutoff };
}
