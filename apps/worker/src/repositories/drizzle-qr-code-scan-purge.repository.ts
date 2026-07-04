import type { Database } from "@auction/db";
import { qrCodeScan } from "@auction/db/schema";
import { inArray, lt } from "drizzle-orm";
import type { IQrCodeScanPurgeRepository } from "../interfaces/qr-code-scan-purge.repository.js";

export class DrizzleQrCodeScanPurgeRepository implements IQrCodeScanPurgeRepository {
  constructor(private readonly db: Database) {}

  async purgeBefore(
    cutoff: Date,
    batchSize: number,
  ): Promise<{ deleted: number; batchCount: number }> {
    const rows = await this.db
      .select({ id: qrCodeScan.id })
      .from(qrCodeScan)
      .where(lt(qrCodeScan.scannedAt, cutoff))
      .limit(batchSize);
    if (rows.length === 0) return { deleted: 0, batchCount: 0 };

    const removed = await this.db
      .delete(qrCodeScan)
      .where(
        inArray(
          qrCodeScan.id,
          rows.map((row) => row.id),
        ),
      )
      .returning({ id: qrCodeScan.id });
    return { deleted: removed.length, batchCount: rows.length };
  }
}
