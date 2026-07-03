import { persistQrCodeScan } from "@auction/db";
import type { Database } from "@auction/db";
import type { QrCodeScanJobPayload } from "@auction/queues";
import type { Queue } from "bullmq";
import type { Redis } from "ioredis";
import type { AppLogger } from "../../lib/logger.js";
import type { IQrCodeRepository } from "../../repositories/interfaces/qr-code.repository.js";
import { QrCodeCache, resolveFromCached } from "./qr-code-cache.js";
import { absoluteWebUrl } from "./qr-code-mapper.js";
import type { QrCodeCachedResolve, QrCodeResolveResult } from "./qr-code-types.js";

export class QrCodePublicResolveService {
  private readonly cache: QrCodeCache;

  constructor(
    private readonly repo: IQrCodeRepository,
    redis: Redis,
    private readonly webOrigin: string,
    private readonly db: Database,
    private readonly logger?: AppLogger,
    private readonly scanQueue?: Queue,
  ) {
    this.cache = new QrCodeCache(redis);
  }

  async resolve(shortCode: string): Promise<QrCodeResolveResult> {
    const cached = await this.cache.get(shortCode);
    if (cached) return resolveFromCached(cached);

    const row = await this.repo.findByShortCode(shortCode);
    if (!row) return { ok: false, status: 404, reason: "not_found" };

    const entity = await this.repo.loadEntity(row.entityType, row.entityId);
    if (!entity) return { ok: false, status: 404, reason: "not_found" };

    const cachedValue: QrCodeCachedResolve = {
      qrCodeId: row.id,
      destinationUrl: absoluteWebUrl(this.webOrigin, entity.destinationPath),
      status: row.status,
      expiresAt: row.expiresAt?.toISOString() ?? null,
    };
    await this.cache.set(shortCode, cachedValue);
    return resolveFromCached(cachedValue);
  }

  async enqueueScan(input: QrCodeScanJobPayload): Promise<void> {
    try {
      if (this.scanQueue) {
        await this.scanQueue.add("record-scan", input);
        return;
      }
      await persistQrCodeScan(this.db, input);
    } catch (error) {
      this.logger?.error(
        { err: error, qr_code_id: input.qrCodeId, request_id: input.requestId ?? undefined },
        "qr_code scan enqueue failed",
      );
    }
  }
}
